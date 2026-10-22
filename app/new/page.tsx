import type { Metadata } from "next";
import Link from "next/link";
import { GroupBuilder } from "@/components/GroupBuilder";

export const metadata: Metadata = {
  title: "Make your own group · Common Ground",
  description: "Add 2–4 friends and their tastes; get one plan that works for everyone, with a reason for each friend.",
};

export default function NewGroupPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm opacity-70">
          ← Common Ground
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Who&apos;s coming?</h1>
        <p className="opacity-80">
          Add 2–4 friends and a few things each of them loves: artists, films, shows, places, dishes. Common Ground finds
          the restaurant where everyone&apos;s tastes overlap, using real Qloo taste data.
        </p>
      </div>
      <GroupBuilder />
    </main>
  );
}
