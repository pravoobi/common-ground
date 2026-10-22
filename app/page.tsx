import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Common Ground</h1>
      <p className="text-lg leading-relaxed">
        A generic AI guesses what your group might like; Common Ground knows
        what each of you loves and finds the plan where those tastes overlap.
      </p>
      <Link
        href="/new"
        className="self-start rounded-full bg-neutral-900 px-5 py-3 font-medium text-white dark:bg-white dark:text-neutral-900"
      >
        Plan for your group
      </Link>
      <p className="text-sm opacity-70">
        Powered by the Qloo taste graph. Sample groups with recorded runs are on
        the way.
      </p>
    </main>
  );
}
