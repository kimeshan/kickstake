"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { challengeApi, formatDate, type MineItem } from "@/lib/challenge";
import { loginWithNext } from "@/lib/safe-next";
import { ChallengeHeader } from "@/components/challenge/header";
import { Spinner, StateCard } from "@/components/challenge/ui";

export default function ChallengesHome() {
  const t = useTranslations("challenge.home");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [items, setItems] = useState<MineItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!session) return;
    challengeApi<{ challenges: MineItem[] }>("/mine")
      .then(({ challenges }) => {
        // One challenge (the common case) → straight to it.
        if (challenges.length === 1) router.replace(`/challenges/${challenges[0].id}`);
        else setItems(challenges);
      })
      .catch(() => setFailed(true));
  }, [session, router]);

  return (
    <>
      <ChallengeHeader signedIn={!!session} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        {isPending ? (
          <Spinner />
        ) : !session ? (
          <div className="space-y-4 text-center">
            <h1 className="font-display text-4xl text-balance">{t("signInTitle")}</h1>
            <p className="text-muted-foreground text-pretty">{t("signInHint")}</p>
            <Link
              href={loginWithNext("/challenges")}
              className="inline-flex h-12 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
            >
              {t("signIn")}
            </Link>
          </div>
        ) : failed ? (
          <StateCard message={tc("states.error")} action={{ label: tc("retry"), onClick: () => location.reload() }} />
        ) : !items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <div className="space-y-3">
            <h1 className="font-display text-3xl">{t("title")}</h1>
            <StateCard message={`${t("empty")} ${t("emptyHint")}`} />
          </div>
        ) : (
          <div className="space-y-3">
            <h1 className="font-display text-3xl">{t("title")}</h1>
            <ul className="space-y-2">
              {items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/challenges/${c.id}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-4 hover:bg-card"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{c.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("dates", {
                          start: formatDate(c.startDate, locale),
                          end: formatDate(c.lastActivityDate, locale),
                        })}{" "}
                        · {c.isOwner ? t("organiser") : t("participant")}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary">{t("open")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </>
  );
}
