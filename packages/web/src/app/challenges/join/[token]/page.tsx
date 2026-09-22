"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import {
  ChallengeApiError,
  challengeApi,
  errorKey,
  formatDate,
  formatNumber,
  type Invitation,
} from "@/lib/challenge";
import { Input } from "@/components/ui/input";
import { EmailOtpForm } from "@/components/email-otp-form";
import { ChallengeHeader } from "@/components/challenge/header";
import { LevelBadge, Spinner, StateCard, useReload } from "@/components/challenge/ui";

/** WhatsApp / social in-app browsers sometimes drop sessions. */
function isInAppBrowser() {
  return typeof navigator !== "undefined" && /WhatsApp|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
}

export default function JoinChallengePage() {
  const t = useTranslations("challenge.join");
  const tc = useTranslations("challenge");
  const te = useTranslations("challenge.errors");
  const locale = useLocale();
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { data: session, isPending, refetch } = useSession();
  const [inv, setInv] = useState<Invitation | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Prefilled from the account name until the person types their own.
  const [typedName, setName] = useState<string | null>(null);
  const name = typedName ?? session?.user.name ?? "";
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inApp = useSyncExternalStore(
    () => () => {},
    isInAppBrowser,
    () => false,
  );
  const [nonce, load] = useReload();

  // (Re-)read once the session settles — viewer status depends on it.
  useEffect(() => {
    if (isPending) return;
    let live = true;
    challengeApi<Invitation>(`/invitations/${encodeURIComponent(token)}`)
      .then((i) => {
        if (!live) return;
        // Already a member → this link just takes you to your progress.
        if (i.viewer?.status === "member" && i.viewer.challengeId)
          return router.replace(`/challenges/${i.viewer.challengeId}`);
        setInv(i);
        setLoadError(false);
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ChallengeApiError && e.status === 404) setMissing(true);
        else setLoadError(true);
      });
    return () => {
      live = false;
    };
  }, [token, router, isPending, session?.user.id, nonce]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    setError(null);
    try {
      const r = await challengeApi<{ challengeId: string }>(
        `/invitations/${encodeURIComponent(token)}/join`,
        { method: "POST", body: JSON.stringify({ displayName: name }) },
      );
      router.replace(`/challenges/${r.challengeId}`);
    } catch (err) {
      setError(te(errorKey(err)));
      if (err instanceof ChallengeApiError && err.status === 401) refetch();
      setJoining(false);
    }
  }

  const card = "rounded-3xl border border-border bg-card/80 p-5";

  return (
    <>
      <ChallengeHeader signedIn={!!session} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 lg:max-w-4xl">
        {missing ? (
          <StateCard message={t("notFound")} />
        ) : loadError ? (
          <StateCard message={tc("states.error")} action={{ label: tc("retry"), onClick: load }} />
        ) : !inv || isPending ? (
          <Spinner />
        ) : (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
            <section className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{t("invited")}</div>
              <h1 className="font-display text-4xl text-balance" dir="auto">
                {inv.title}
              </h1>
              <p className="font-semibold">
                {t("dates", {
                  start: formatDate(inv.startDate, locale),
                  end: formatDate(inv.lastActivityDate, locale),
                })}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{t("baseline", { count: formatNumber(inv.baselineMinutes, locale) })}</li>
                <li>{t("weeks", { count: inv.weekCount })}</li>
                <li>{tc("timeZoneNote", { tz: inv.timeZone })}</li>
              </ul>
              <p className="text-sm">{t("howItWorks")}</p>
              <div className="flex flex-wrap gap-1.5">
                {inv.ladder
                  .filter((r, i, all) => r.level > 0 && (i === all.findIndex((x) => x.medal === r.medal)))
                  .map((r) => (
                    <LevelBadge key={r.level} level={r.level} medal={r.medal} size="sm" />
                  ))}
              </div>
            </section>

            <section className={card}>
              {inv.viewer?.status === "removed" ? (
                <p role="alert" className="text-sm">{t("removed")}</p>
              ) : !inv.joinable ? (
                <p className="text-sm">{inv.unavailableReason === "challenge_ended" ? t("ended") : t("closed")}</p>
              ) : !session ? (
                <>
                  <p className="mb-4 rounded-xl bg-secondary/60 p-3 text-sm">{t("privacy")}</p>
                  <EmailOtpForm
                    emailTitle={t("signInTitle")}
                    emailSub={t("signInHint")}
                    onSignedIn={() => refetch()}
                  />
                  {inApp && <p className="mt-4 text-xs text-muted-foreground">{t("inAppBrowser")}</p>}
                </>
              ) : (
                <form onSubmit={join} className="space-y-3">
                  {inv.viewer?.status === "owner" && inv.viewer.challengeId && (
                    <div className="rounded-xl bg-secondary/60 p-3 text-sm">
                      <p>{t("organiserNotice")}</p>
                      <Link
                        href={`/challenges/${inv.viewer.challengeId}/manage`}
                        className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary underline"
                      >
                        {t("openManage")}
                      </Link>
                    </div>
                  )}
                  <p className="rounded-xl bg-secondary/60 p-3 text-sm">{t("privacy")}</p>
                  <label htmlFor="display-name" className="block font-semibold">
                    {t("nameLabel")}
                  </label>
                  <Input
                    id="display-name"
                    autoComplete="nickname"
                    maxLength={50}
                    placeholder={t("namePlaceholder")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-describedby="name-hint"
                  />
                  <p id="name-hint" className="text-xs text-muted-foreground">
                    {t("nameHint")}
                  </p>
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={joining || !name.trim()}
                    className="h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
                  >
                    {joining ? t("joining") : t("join")}
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
