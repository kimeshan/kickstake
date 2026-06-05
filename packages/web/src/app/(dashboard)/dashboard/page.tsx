import Link from "next/link";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const steps = t.raw("steps") as { title: string; desc: string }[];

  return (
    <div className="space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            {t("organiser")}
          </p>
          <h1 className="font-display text-4xl">{t("title")}</h1>
        </div>
        <Link
          href="/dashboard/new"
          className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          {t("start")}
        </Link>
      </div>

      {/* Empty state */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-6 py-14 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="text-5xl">🏆</div>
        <h2 className="mt-4 font-display text-2xl">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          {t("emptyBody")}
        </p>
        <Link
          href="/dashboard/new"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground transition active:scale-[.98]"
        >
          {t("emptyCta")}
        </Link>
      </div>

      {/* How it works */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("howTitle")}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-border bg-card/40 p-4"
            >
              <div className="font-display text-2xl text-primary">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-1 font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
