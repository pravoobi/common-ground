// Makes the Devpost gallery images (1200x800, 3:2 PNG) from the live site with headless Chrome.
// No dependencies: Chrome DevTools Protocol over Node's built-in WebSocket.
// Output goes to ./gallery/ (gitignored: the images show recorded Qloo data).
//   node scripts/gallery.mjs [baseUrl]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = (process.argv[2] ?? "https://common-ground-phi-bice.vercel.app").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = resolve("gallery");
const W = 800;
const H = 533; // 3:2; at scale 1.5 the PNG is 1200x800
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const OPEN_XRAY = `[...document.querySelectorAll('details')].forEach(d => { if (d.textContent.includes('X-ray')) d.open = true; })`;
const byText = (tag, text) => `[...document.querySelectorAll('${tag}')].find(e => e.textContent.includes(${JSON.stringify(text)}))`;

const SHOTS = [
  { file: "01-plan-card", url: "/g/birthday-with-amma", wait: "[aria-label='Plan message']", target: "document.querySelector(\"[aria-label='Plan message']\")", nudge: -60 },
  { file: "02-fairness-vs-averaging", url: "/present", wait: "#overlap", target: "document.querySelector('#overlap')", nudge: -10 },
  { file: "03-without-vs-with-qloo", url: "/g/college-friends", wait: "#compare-heading", target: "document.querySelector('#compare-heading')", nudge: -16 },
  { file: "04-least-happy-friend-table", url: "/g/couple-date-night", wait: "#compare-heading", target: "document.querySelector('#compare-heading').closest('section').querySelector('table')", nudge: -50 },
  { file: "05-xray-tastes", url: "/g/birthday-with-amma", wait: "details", before: OPEN_XRAY, target: byText("summary", "X-ray"), nudge: -10 },
  { file: "06-xray-scores", url: "/g/birthday-with-amma", wait: "details", before: OPEN_XRAY, target: byText("h4", "Fair ranking"), nudge: -10 },
  { file: "07-xray-qloo-calls", url: "/g/birthday-with-amma", wait: "details", before: OPEN_XRAY, target: byText("h4", "Every Qloo call"), nudge: -10 },
  { file: "08-the-number", url: "/present", wait: "#number", target: "document.querySelector('#number')", nudge: -10 },
  { file: "09-sample-groups", url: "/", wait: "main", target: "document.querySelector('main')", nudge: 0 },
  { file: "10-make-your-own-group", url: "/new", wait: "form", target: "document.querySelector('main')", nudge: 0 },
];

// Two drawn images that need no site: the architecture and the passing tests.
const ARCH = `<!doctype html><meta charset=utf-8><style>
body{margin:0;width:${W}px;height:${H}px;font:15px system-ui,sans-serif;background:#fff;color:#171717;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:0 28px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 4px}.row{display:flex;gap:10px;align-items:stretch}.row>.box{flex:1}.box{border:1.5px solid #bbb;border-radius:10px;padding:10px 12px}
.hi{border-color:#10b981;border-width:2px}.arrow{text-align:center;color:#888;font-size:13px}small{color:#666;display:block;margin-top:3px;font-size:12px}b{font-weight:600}</style>
<h1>Common Ground: how a plan is made</h1>
<div class=row><div class=box><b>Browser</b><small>/new, /g/id, /present</small></div><div class=box><b>/api/plan</b><small>origin check · caps (browser, IP, day) · streams steps</small></div><div class=box><b>Upstash Redis</b><small>recorded samples (private) · Qloo cache · caps</small></div></div>
<div class=arrow>▼</div>
<div class="box hi"><b>Claude agent (Tool Runner, claude-sonnet-5-5)</b><small>decides which tools to call · writes one sentence per friend · never produces a number</small></div>
<div class=arrow>▼ five tools</div>
<div class=row><div class=box><b>resolve_tastes</b><small>/search · /v2/tags</small></div><div class=box><b>choose_option</b><small>only ids Qloo returned</small></div><div class=box><b>find_candidates</b><small>/v2/insights</small></div><div class=box><b>rank_for_group</b><small>/v2/insights + explainability</small></div><div class=box><b>explain_pick</b><small>evidence ids</small></div></div>
<div class=arrow>▼</div>
<div class=row><div class="box hi"><b>Qloo API</b><small>/search · /v2/tags · /v2/insights (filter.results.entities, feature.explainability)</small></div><div class="box hi"><b>Deterministic code (TypeScript, tested)</b><small>percentile per friend · hard limits (veg, budget) · maximin pick, tie-break on mean</small></div></div>
</body>`;

function testsHtml() {
  const out = process.env.TEST_OUTPUT ?? "";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><meta charset=utf-8><style>body{margin:0;width:${W}px;height:${H}px;background:#0d1117;color:#c9d1d9;font:14px ui-monospace,Consolas,monospace;padding:28px;box-sizing:border-box;white-space:pre-wrap}
.g{color:#3fb950}.d{color:#8b949e}h1{font:600 18px system-ui;color:#fff;margin:0 0 12px}</style><h1>npm test: hand-written fixtures, no network</h1>${esc(out)
    .split("\n")
    .map((l) => (l.includes("✓") ? `<span class=g>${l}</span>` : /Tests|Test Files/.test(l) ? `<b class=g>${l}</b>` : `<span class=d>${l}</span>`))
    .join("\n")}</body>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "cg-gallery-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--headless=new", "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
  try {
    let targets;
    for (let i = 0; i < 40; i++) {
      try {
        targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        if (targets.some((t) => t.type === "page")) break;
      } catch {}
      await sleep(250);
    }
    const page = targets.find((t) => t.type === "page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
    };
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const n = ++id;
        pending.set(n, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    const evalJs = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1.5, mobile: false });
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });

    const shoot = async (file) => {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(OUT, `${file}.png`), Buffer.from(data, "base64"));
      console.log("wrote", `${file}.png`);
    };

    for (const s of SHOTS) {
      await send("Page.navigate", { url: BASE + s.url });
      let found = false;
      for (let i = 0; i < 60 && !found; i++) {
        await sleep(250);
        found = (await evalJs(`!!document.querySelector(${JSON.stringify(s.wait)})`)).result.value === true;
      }
      if (!found) {
        console.error("skipped (selector never appeared):", s.file);
        continue;
      }
      await sleep(600);
      if (s.before) await evalJs(s.before);
      await evalJs(`(() => { const el = ${s.target}; if (el) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, ${s.nudge}); } })()`);
      await sleep(400);
      await shoot(s.file);
    }

    const local = [
      ["11-architecture", ARCH],
      ["12-passing-tests", testsHtml()],
    ];
    for (const [file, html] of local) {
      const path = join(profile, `${file}.html`);
      writeFileSync(path, html);
      await send("Page.navigate", { url: pathToFileURL(path).href });
      await sleep(700);
      await shoot(file);
    }
    ws.close();
  } finally {
    chrome.kill();
    await sleep(500);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
