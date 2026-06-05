import Link from "next/link";
import { Logo } from "@/components/brand";
import { EMAIL } from "@/lib/constants";

/* ------------------------------------------------------------------ *
 *  KickStake — landing page. "Matchday" aesthetic: near-black pitch,
 *  electric lime, scoreboard display type. Server component (static).
 * ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="grain flex min-h-screen flex-col overflow-x-hidden">
      <Nav />
      <Hero />
      <TrustStrip />
      <OldWayVsKickStake />
      <HowItWorks />
      <Features />
      <Prizes />
      <StatsBand />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* --------------------------------- Nav -------------------------------- */
function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition hover:text-foreground">
            How it works
          </a>
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-[.97]"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------- Hero -------------------------------- */
function Hero() {
  return (
    <section className="relative">
      {/* floodlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div className="duration-700 animate-in fade-in slide-in-from-bottom-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            ⚽ 2026 FIFA World Cup — pre-loaded
          </span>
          <h1 className="mt-5 font-display text-6xl text-balance sm:text-7xl">
            The group sweepstake,
            <br />
            <span className="text-primary">sorted.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground text-balance">
            Spin up a tournament sweepstake, drop one link in the group chat,
            and KickStake runs the random draw, splits the prize pot, tracks
            who&apos;s paid, and settles up at the end.{" "}
            <span className="text-foreground">
              No spreadsheets. No arguments.
            </span>
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="rounded-xl bg-primary px-7 py-4 text-lg font-semibold text-primary-foreground transition active:scale-[.98]"
            >
              Start a KickStake →
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-border px-7 py-4 text-lg font-medium text-foreground transition hover:bg-secondary/60"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free to start · players join with no account · ~60 seconds to set up
          </p>
        </div>

        {/* phone mockup */}
        <div className="flex justify-center duration-1000 animate-in fade-in zoom-in-95 lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[300px]">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 translate-y-6 scale-95 rounded-[2.5rem] bg-primary/20 blur-2xl"
      />
      <div className="grain overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#0b0f0a] shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-3.5 pb-1.5 text-[10px] text-muted-foreground">
          <span>9:41</span>
          <span className="font-semibold text-foreground">kickstake.app</span>
          <span>●●●▮</span>
        </div>
        <div className="px-5 pb-6 pt-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
            You&apos;re invited
          </div>
          <div className="mt-1 font-display text-2xl leading-none">
            Office World Cup &apos;26
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Hosted by Priya · 2026 FIFA World Cup
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["R150", "Buy-in"],
              ["R2 000", "Pot"],
              ["11", "In"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-card p-2.5 text-center">
                <div className="font-display text-xl text-primary">{v}</div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  {l}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-card p-3">
            <div className="text-xs font-semibold">12 prizes up for grabs</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                🏆 R500
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5">
                ⚽ Golden Boot
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5">
                🟥 Dirtiest
              </span>
              <span className="px-1 py-0.5 text-muted-foreground">+9</span>
            </div>
          </div>

          <button className="mt-4 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
            Join the KickStake →
          </button>
          <div className="mt-2 text-center text-[10px] text-muted-foreground">
            No account. No password.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Trust strip ---------------------------- */
function TrustStrip() {
  const items = [
    "🎲 Provably-fair draws",
    "🔒 Tracking-only — we never touch your money",
    "📲 No app to install",
    "🆓 Free to start",
  ];
  return (
    <div className="border-y border-border bg-card/30">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-5 py-4 text-sm text-muted-foreground">
        {items.map((i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Old way vs KickStake ----------------------- */
function OldWayVsKickStake() {
  const oldWay = [
    "Build a spreadsheet nobody understands",
    "Draw team names out of an actual hat",
    "Work out the prize splits by hand",
    "Chase everyone on WhatsApp for the buy-in",
    "Argue about who won which prize",
  ];
  const newWay = [
    "Prize pot auto-built, balanced to the cent",
    "One-tap draw — seeded and provably fair",
    "Winners auto-suggested, you just approve",
    "Paid tracking + a clean settlement summary",
    "Everyone sees their teams & live winnings",
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Why bother"
        title="The end of sweepstake admin"
        sub="If you've ever organised one, you know the pain. KickStake does the boring, argument-starting parts for you."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/40 p-7">
          <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            The old way
          </div>
          <ul className="mt-5 space-y-3">
            {oldWay.map((t) => (
              <li key={t} className="flex gap-3 text-muted-foreground">
                <span className="text-destructive">✕</span>
                <span className="line-through decoration-destructive/40">
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-primary/[0.06] p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 right-0 size-40 rounded-full bg-primary/15 blur-3xl"
          />
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <Logo showWord={false} className="[&_span]:size-6 [&_span]:text-base" />
            With KickStake
          </div>
          <ul className="mt-5 space-y-3">
            {newWay.map((t) => (
              <li key={t} className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- How it works --------------------------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Create",
      d: "Pick the tournament, set the buy-in. KickStake auto-builds a 12-prize pot you can tweak.",
    },
    {
      n: "02",
      t: "Share",
      d: "Send one link to the group chat. Everyone joins with just a name — no account.",
    },
    {
      n: "03",
      t: "Draw",
      d: "Hit Run Draw. All 48 teams are assigned fairly and locked, with a stored seed.",
    },
    {
      n: "04",
      t: "Settle",
      d: "Approve the auto-suggested winners. See live winnings and who owes who.",
    },
  ];
  return (
    <section id="how" className="border-y border-border bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="From idea to kickoff in four steps"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="group relative rounded-3xl border border-border bg-card/50 p-6 transition hover:border-primary/40"
            >
              <div className="font-display text-5xl text-primary/90 transition group-hover:scale-105">
                {s.n}
              </div>
              <div className="mt-3 text-lg font-semibold">{s.t}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Features ----------------------------- */
function Features() {
  const features = [
    {
      icon: "🎲",
      t: "Provably-fair draws",
      d: "Every draw stores a random seed. Re-run it and get the exact same result — with a 'how the draw worked' explainer for the sceptics.",
    },
    {
      icon: "💰",
      t: "Auto prize pot",
      d: "Set the buy-in and KickStake builds a balanced prize structure that reconciles to the cent. Edit any amount — it rebalances live.",
    },
    {
      icon: "🏆",
      t: "12 prize categories",
      d: "Winner, runner-up and bronze, plus per-group prizes and comedy categories like Golden Boot, Dirtiest Team and Best Defence.",
    },
    {
      icon: "📲",
      t: "Join with a link",
      d: "Players tap your link, type a name, and they're in. No account, no password, nothing to install. Built for the group chat.",
    },
    {
      icon: "✅",
      t: "You stay in control",
      d: "Results are auto-suggested from the tournament, but nothing pays out until you approve it. Override any winner, any time.",
    },
    {
      icon: "🧾",
      t: "Settlement, done",
      d: "Each player's net — winnings minus buy-in — plus who owes who. Money moves off-app; KickStake just keeps the books straight.",
    },
  ];
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
      <SectionHeading
        eyebrow="Features"
        title="Everything the organiser hates, automated"
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.t}
            className="rounded-3xl border border-border bg-card/40 p-6 transition hover:-translate-y-1 hover:border-primary/30"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-2xl">
              {f.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Prizes ------------------------------- */
function Prizes() {
  const chips = [
    ["🏆", "Winner", "25%"],
    ["🥈", "Runner-up", "13%"],
    ["🥉", "Bronze", "5%"],
    ["⬆️", "Top of group", "×12"],
    ["⬇️", "Bottom of group", "×12"],
    ["⚽", "Golden Boot", "4%"],
    ["🎯", "Player of the Tournament", "4%"],
    ["🟥", "Dirtiest team", "4%"],
    ["🛡️", "Best defence", "5%"],
    ["📈", "Most possession", "4%"],
    ["💥", "Biggest single-game loss", "5%"],
  ];
  return (
    <section className="border-y border-border bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <SectionHeading
          eyebrow="The prize pot"
          title="More ways to win than just picking the champions"
          sub="The default split is drawn from real, battle-tested sweepstakes and always adds up to exactly the pot. Toggle any prize on or off."
        />
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
          {chips.map(([icon, label, share]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm transition hover:border-primary/40"
            >
              <span className="text-base">{icon}</span>
              <span className="font-medium">{label}</span>
              <span className="text-xs text-primary">{share}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Stats band ---------------------------- */
function StatsBand() {
  const stats = [
    ["~60s", "to set up"],
    ["48", "teams drawn in one tap"],
    ["12", "prizes auto-calculated"],
    ["0", "spreadsheets required"],
  ];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
      <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card/40 px-6 py-10 text-center sm:grid-cols-4">
        {stats.map(([v, l]) => (
          <div key={l}>
            <div className="font-display text-5xl text-primary sm:text-6xl">
              {v}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- FAQ -------------------------------- */
function Faq() {
  const faqs = [
    {
      q: "Does KickStake handle the money?",
      a: "No — it's tracking-only. You record the buy-in and tick off who's paid; the actual payment happens however your group already does it (EFT, cash, whatever). At the end KickStake produces a settlement summary so nobody has to do the maths.",
    },
    {
      q: "Is the draw actually fair?",
      a: "Yes. Every draw is generated from a stored random seed and is fully reproducible. Everyone can see every team assignment, plus a 'how the draw worked' explainer. No rigged hats.",
    },
    {
      q: "Do players need to sign up?",
      a: "No. Organisers sign in with a one-time email code or Google. Players just open the share link and enter a name — no account, no password, no app.",
    },
    {
      q: "Which tournaments are supported?",
      a: "The 2026 FIFA World Cup is pre-loaded — all 48 teams across 12 groups. More tournaments are on the way.",
    },
    {
      q: "What does it cost?",
      a: "Free to start. Set up a sweepstake, run the draw, and settle up at no cost.",
    },
  ];
  return (
    <section id="faq" className="border-t border-border bg-card/20">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:py-28">
        <SectionHeading eyebrow="FAQ" title="The questions every organiser asks" />
        <div className="mt-10 space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-border bg-card/50 px-5 open:border-primary/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-medium">
                {f.q}
                <span className="ml-4 text-primary transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Final CTA ----------------------------- */
function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="mx-auto w-full max-w-3xl px-5 py-24 text-center sm:py-32">
        <h2 className="font-display text-5xl text-balance sm:text-7xl">
          Ready to kick off?
        </h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground text-balance">
          Your group is already arguing about who&apos;ll win. Give them
          something to actually play for.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          Start a KickStake — free →
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------- */
function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo />
        <p>Tracking-only. KickStake never processes payments.</p>
        <div className="flex items-center gap-4">
          <a
            href={`mailto:${EMAIL.contact}`}
            className="transition hover:text-foreground"
          >
            {EMAIL.contact}
          </a>
          <span>© 2026 KickStake</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------- Shared heading -------------------------- */
function SectionHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl text-balance sm:text-5xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-muted-foreground text-balance">{sub}</p>
      )}
    </div>
  );
}
