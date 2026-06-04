import Link from "next/link";
import { Logo } from "@/components/brand";

export default function Home() {
  return (
    <div className="grain flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link
          href="/login"
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/60"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          ⚽ 2026 FIFA World Cup — pre-loaded
        </span>
        <h1 className="font-display text-6xl text-balance sm:text-8xl">
          The group sweepstake,
          <br />
          <span className="text-primary">sorted.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          Create a tournament sweepstake, share one link, and let KickStake run
          the draw, the prizes, and the settlement for you.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-xl bg-primary px-7 py-4 text-lg font-semibold text-primary-foreground transition active:scale-[.98]"
          >
            Start a KickStake →
          </Link>
          <span className="text-sm text-muted-foreground">
            No account for players · pay off-app
          </span>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-5 py-6 text-center text-xs text-muted-foreground sm:text-left">
        Tracking-only. KickStake never processes payments.
      </footer>
    </div>
  );
}
