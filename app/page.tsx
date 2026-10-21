export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Common Ground</h1>
      <p className="text-lg leading-relaxed">
        A generic AI guesses what your group might like; Common Ground knows
        what each of you loves and finds the plan where those tastes overlap.
      </p>
      <p className="text-sm opacity-70">
        Powered by the Qloo taste graph. Sample groups and the live planner are
        on the way.
      </p>
    </main>
  );
}
