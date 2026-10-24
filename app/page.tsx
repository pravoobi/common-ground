import Link from "next/link";
import { SAMPLES } from "@/lib/samples";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Common Ground</h1>
        <p className="text-lg leading-relaxed">
          A generic AI guesses what your group might like; Common Ground knows what each of you loves and finds the plan
          where those tastes overlap.
        </p>
        <p className="opacity-80">
          Tell it who&apos;s coming and a few things each friend loves: artists, films, shows, dishes. It matches every
          taste on the Qloo taste graph, scores places for each person, and picks the restaurant whose least-happy friend
          is happiest, with a reason for every friend, ready to paste into the group chat.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">Try it in a minute: sample groups</h2>
        {SAMPLES.map((s) => (
          <Link
            key={s.id}
            href={`/g/${s.id}`}
            className="rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <p className="font-medium">{s.group.title}</p>
            <p className="mt-1 text-sm opacity-75">{s.blurb}</p>
          </Link>
        ))}
        <p className="text-xs opacity-60">Samples replay real recorded runs: instant, free, and the same for every visitor.</p>
      </section>

      <Link
        href="/new"
        className="self-start rounded-full bg-neutral-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Plan for your own group
      </Link>
      <p className="text-sm opacity-70">
        <Link href="/present" className="underline">
          Read the story in five short chapters
        </Link>
      </p>
      <p className="text-sm opacity-70">Powered by the Qloo taste graph and Claude.</p>
    </main>
  );
}
