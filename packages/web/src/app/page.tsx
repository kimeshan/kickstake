import Link from "next/link";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LandingNav } from "@/components/landing-nav";
import { RequestTournament } from "@/components/request-tournament";
import { EMAIL, GITHUB_URL, CONTRIBUTE_URL, MAKER } from "@/lib/constants";

/* ------------------------------------------------------------------ *
 *  KickStake — landing page. "Matchday" aesthetic: near-black pitch,
 *  electric lime, scoreboard display type. Server component (static).
 *  All copy lives in messages/*.json via next-intl.
 * ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="grain flex min-h-screen flex-col overflow-x-hidden">
      <LandingNav />
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

/* -------------------------------- Hero -------------------------------- */
function Hero() {
  const t = useTranslations("hero");
  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div className="duration-700 animate-in fade-in slide-in-from-bottom-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {t("badge")}
          </span>
          <h1 className="mt-5 font-display text-6xl text-balance sm:text-7xl">
            {t("titleLine1")}
            <br />
            <span className="text-primary">{t("titleAccent")}</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground text-balance">
            {t("subtitle")}{" "}
            <span className="text-foreground">{t("subtitleEmphasis")}</span>
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="rounded-xl bg-primary px-7 py-4 text-lg font-semibold text-primary-foreground transition active:scale-[.98]"
            >
              {t("ctaPrimary")}
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-border px-7 py-4 text-lg font-medium text-foreground transition hover:bg-secondary/60"
            >
              {t("ctaSecondary")}
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{t("microcopy")}</p>
        </div>

        <div className="flex justify-center duration-1000 animate-in fade-in zoom-in-95 lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}

function PhoneMockup() {
  const t = useTranslations("phone");
  const stats: [string, string][] = [
    ["R150", t("buyIn")],
    ["R2 000", t("pot")],
    ["11", t("in")],
  ];
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
            {t("invited")}
          </div>
          <div className="mt-1 font-display text-2xl leading-none">
            Office World Cup &apos;26
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("hostedBy", { name: "Priya" })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {stats.map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-card p-2.5 text-center">
                <div className="font-display text-xl text-primary">{v}</div>
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                  {l}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl bg-card p-3">
            <div className="text-xs font-semibold">{t("prizesTitle")}</div>
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

          <div className="mt-4 text-center text-[10px] text-muted-foreground">
            {t("noAccount")}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Trust strip ---------------------------- */
function TrustStrip() {
  const t = useTranslations("trust");
  const items = [t("fair"), t("tracking"), t("noInstall"), t("free")];
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
  const t = useTranslations("oldWay");
  const oldWay = t.raw("old") as string[];
  const newWay = t.raw("new") as string[];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
      <SectionHeading
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/40 p-7">
          <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("oldLabel")}
          </div>
          <ul className="mt-5 space-y-3">
            {oldWay.map((text) => (
              <li key={text} className="flex gap-3 text-muted-foreground">
                <span className="text-destructive">✕</span>
                <span className="line-through decoration-destructive/40">
                  {text}
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
            <Logo showWord={false} className="[&_svg]:size-6" />
            {t("newLabel")}
          </div>
          <ul className="mt-5 space-y-3">
            {newWay.map((text) => (
              <li key={text} className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>{text}</span>
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
  const t = useTranslations("how");
  const steps = t.raw("steps") as { title: string; desc: string }[];
  return (
    <section id="how" className="border-y border-border bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="group relative rounded-3xl border border-border bg-card/50 p-6 transition hover:border-primary/40"
            >
              <div className="font-display text-5xl text-primary/90 transition group-hover:scale-105">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-3 text-lg font-semibold">{s.title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Features ----------------------------- */
function Features() {
  const t = useTranslations("features");
  const icons = ["🎲", "💰", "🏆", "📲", "✅", "🧾"];
  const items = t.raw("items") as { title: string; desc: string }[];
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28"
    >
      <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <div
            key={f.title}
            className="rounded-3xl border border-border bg-card/40 p-6 transition hover:-translate-y-1 hover:border-primary/30"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-secondary text-2xl">
              {icons[i]}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Prizes ------------------------------- */
function Prizes() {
  const t = useTranslations("prizes");
  const chips: [string, string, string][] = [
    ["🏆", t("winner"), "25%"],
    ["🥈", t("runnerUp"), "13%"],
    ["🥉", t("bronze"), "5%"],
    ["⬆️", t("topOfGroup"), "×12"],
    ["⬇️", t("bottomOfGroup"), "×12"],
    ["⚽", t("goldenBoot"), "4%"],
    ["🎯", t("playerOfTournament"), "4%"],
    ["🟥", t("dirtiestTeam"), "4%"],
    ["🛡️", t("bestDefence"), "5%"],
    ["📈", t("mostPossession"), "4%"],
    ["💥", t("biggestLoss"), "5%"],
  ];
  return (
    <section className="border-y border-border bg-card/20">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-28">
        <SectionHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          sub={t("sub")}
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
  const t = useTranslations("stats");
  const values = ["~60s", "48", "12", "0"];
  const labels = t.raw("labels") as string[];
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:py-24">
      <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-card/40 px-6 py-10 text-center sm:grid-cols-4">
        {values.map((v, i) => (
          <div key={labels[i]}>
            <div className="font-display text-5xl text-primary sm:text-6xl">
              {v}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {labels[i]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- FAQ -------------------------------- */
function Faq() {
  const t = useTranslations("faq");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <section id="faq" className="border-t border-border bg-card/20">
      <div className="mx-auto w-full max-w-3xl px-5 py-20 sm:py-28">
        <SectionHeading eyebrow={t("eyebrow")} title={t("title")} />
        <div className="mt-10 space-y-3">
          {items.map((f) => (
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
  const t = useTranslations("finalCta");
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]"
      />
      <div className="mx-auto w-full max-w-3xl px-5 py-24 text-center sm:py-32">
        <h2 className="font-display text-5xl text-balance sm:text-7xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-md text-lg text-muted-foreground text-balance">
          {t("subtitle")}
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          {t("button")}
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------- */
function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("tracking")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("openSource")}{" "}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {t("github")}
              </a>
            </p>
            <a
              href={CONTRIBUTE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-medium text-primary transition hover:opacity-80"
            >
              {t("contribute")}
            </a>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              {t("terms")}
            </Link>
            <a
              href={`mailto:${EMAIL.contact}`}
              className="transition hover:text-foreground"
            >
              {EMAIL.contact}
            </a>
            <RequestTournament />
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            {t("madeBy")}{" "}
            <a
              href={MAKER.url}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              {MAKER.name}
            </a>
          </p>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <span>{t("copyright", { year: String(new Date().getFullYear()) })}</span>
          </div>
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
  eyebrow?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 font-display text-4xl text-balance sm:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-muted-foreground text-balance">{sub}</p>}
    </div>
  );
}
