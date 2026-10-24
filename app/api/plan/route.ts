import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { runAgent } from "@/lib/agent/run";
import { getCache, getRedis } from "@/lib/cache";
import { capLimitsFromEnv, cleanSessionId, memoryCounter, redisCounter, takeLiveRun, type Counter } from "@/lib/caps";
import { GroupInput } from "@/lib/group";

// A live plan takes ~30–40 s (SPIKES.md §7); leave room for slow Qloo or model turns.
export const maxDuration = 120;

const SESSION_COOKIE = "cg_sid";
let devCounter: Counter | undefined;

/** Live "make your own group" run: capped, streamed as server-sent events. Samples never come here. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error(403, "Cross-site requests are not allowed.");

  const missing = ["ANTHROPIC_API_KEY", "QLOO_API_KEY", "QLOO_BASE_URL"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[plan] not configured: ${missing.join(", ")}`);
    return error(503, "The live planner isn't configured on this deployment. The sample groups still work.");
  }

  const parsed = GroupInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, `That group doesn't look right: ${parsed.error.issues[0]?.message ?? "invalid input"}.`);

  const sessionId = cleanSessionId(request.cookies.get(SESSION_COOKIE)?.value, randomUUID);
  const redis = getRedis();
  const counter = redis ? redisCounter(redis) : (devCounter ??= memoryCounter());
  const cap = await takeLiveRun(counter, sessionId, capLimitsFromEnv(), new Date(), clientIp(request));
  const cookie = `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${
    request.nextUrl.protocol === "https:" ? "; Secure" : ""
  }`;
  if (!cap.allowed) {
    const message =
      cap.reason !== "day"
        ? "You've used your live plans for today. The sample groups are still open."
        : "The live planner has hit today's limit. Try a sample group, or come back tomorrow.";
    return error(429, message, { "set-cookie": cookie });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "cap", sessionLeft: cap.sessionLeft });
      try {
        const record = await runAgent(parsed.data, {
          qloo: { baseUrl: process.env.QLOO_BASE_URL!, apiKey: process.env.QLOO_API_KEY!, cache: getCache() },
          onStep: (e) => send({ type: "step", ...e }),
        });
        // Logged without names or tastes (CLAUDE.md §6).
        console.log(
          `[plan] ok people=${parsed.data.people.length} ms=${record.timings.totalMs} qloo=${record.qlooCalls.length} tokens=${record.usage.inputTokens}/${record.usage.outputTokens}`,
        );
        send({ type: "done", record });
      } catch (err) {
        console.error(`[plan] failed: ${(err as Error).message}`);
        send({ type: "error", message: "Something went wrong while planning. Please try again in a minute." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "set-cookie": cookie,
    },
  });
}

/** Browsers send Origin on cross-site POSTs; "null" and unparseable values are refused too. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

/** Vercel sets x-forwarded-for from the real connection; the first entry is the client. */
function clientIp(request: NextRequest): string | undefined {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip && ip.length <= 45 ? ip : undefined;
}

function error(status: number, message: string, headers: Record<string, string> = {}) {
  return Response.json({ error: message }, { status, headers });
}
