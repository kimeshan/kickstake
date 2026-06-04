import Link from "next/link";

const STEPS = [
  { n: "01", t: "Create", d: "Pick the tournament, set the buy-in, auto-build the prize pot." },
  { n: "02", t: "Share", d: "Drop the link in the group chat. Everyone joins with just a name." },
  { n: "03", t: "Draw", d: "One tap assigns all 48 teams. Provably fair, fully auditable." },
  { n: "04", t: "Settle", d: "Approve the winners, see who owes who. KickStake keeps the books." },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Organiser
          </p>
          <h1 className="font-display text-4xl">Your KickStakes</h1>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          + Start a KickStake
        </Link>
      </div>

      {/* Empty state */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="text-5xl">🏆</div>
        <h2 className="mt-4 font-display text-2xl">No KickStakes yet</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Spin up your first sweepstake for the 2026 FIFA World Cup — it takes
          about a minute.
        </p>
        <Link
          href="/dashboard/new"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          Start a KickStake
        </Link>
      </div>

      {/* How it works */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          How it works
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-border bg-card/40 p-4"
            >
              <div className="font-display text-2xl text-primary">{s.n}</div>
              <div className="mt-1 font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
