import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GroupSummary } from "@/components/GroupSummary";
import { PlanView } from "@/components/PlanView";
import { loadReplay } from "@/lib/replays";
import { getSample, SAMPLES } from "@/lib/samples";

// The recorded samples are prerendered; any other id is a 404 (see notFound below).
export function generateStaticParams() {
  return SAMPLES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/g/[id]">): Promise<Metadata> {
  const sample = getSample((await params).id);
  return sample ? { title: `${sample.group.title} · Common Ground`, description: sample.blurb } : {};
}

/** Replays are read from Redis, never recomputed: no Qloo or model calls on page load. */
async function getReplay(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`replay-${id}`);
  return loadReplay(id);
}

async function Replay({ id }: { id: string }) {
  const record = await getReplay(id);
  if (!record) return <p className="text-sm opacity-70">This sample hasn&apos;t been recorded yet.</p>;
  return <PlanView record={record} />;
}

export default async function SamplePage({ params }: PageProps<"/g/[id]">) {
  const { id } = await params;
  const sample = getSample(id);
  if (!sample) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm opacity-70">
          ← Common Ground
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{sample.group.title}</h1>
        <p className="opacity-80">{sample.blurb}</p>
        <p className="text-xs opacity-60">The people are fictional. Their tastes went through the real agent and real Qloo data.</p>
      </div>
      <GroupSummary group={sample.group} />
      <Suspense fallback={<p className="text-sm opacity-70">Loading the recorded plan…</p>}>
        <Replay id={id} />
      </Suspense>
      <Link href="/new" className="self-start text-sm underline">
        Try it with your own group
      </Link>
    </main>
  );
}
