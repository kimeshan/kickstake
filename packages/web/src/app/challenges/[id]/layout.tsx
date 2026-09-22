"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ChallengeApiError, challengeApi, type ChallengeDetail } from "@/lib/challenge";
import { loginWithNext } from "@/lib/safe-next";
import { ChallengeContext } from "@/components/challenge/context";
import { ChallengeHeader, type MenuAction } from "@/components/challenge/header";
import { RenameDialog } from "@/components/challenge/rename-dialog";
import { Spinner, StateCard, useRefreshOnFocus, useReload } from "@/components/challenge/ui";

type LoadState = "loading" | "ready" | "not_found" | "not_member" | "removed" | "error";

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("challenge");
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [renaming, setRenaming] = useState(false);

  const [nonce, load] = useReload();

  useEffect(() => {
    let live = true;
    challengeApi<ChallengeDetail>(`/${id}`)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setState("ready");
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ChallengeApiError) {
          if (e.status === 401) return router.replace(loginWithNext(pathname));
          if (e.code === "membership_removed") return setState("removed");
          if (e.code === "not_a_member") return setState("not_member");
          if (e.status === 404) return setState("not_found");
        }
        // Keep showing the last good data on a transient refresh failure.
        setState((s) => (s === "ready" ? s : "error"));
      });
    return () => {
      live = false;
    };
    // pathname is only read for the login return path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nonce, router]);
  useRefreshOnFocus(load);

  const base = `/challenges/${id}`;

  if (state !== "ready" || !detail) {
    const message =
      state === "not_found"
        ? t("states.notFound")
        : state === "not_member"
          ? t("states.notMember")
          : state === "removed"
            ? t("states.removed")
            : t("states.error");
    return (
      <>
        <ChallengeHeader />
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
          {state === "loading" ? (
            <Spinner />
          ) : (
            <StateCard
              tone={state === "removed" ? "warn" : "muted"}
              message={message}
              action={
                state === "error"
                  ? { label: t("retry"), onClick: load }
                  : { label: t("states.home"), href: "/challenges" }
              }
            />
          )}
        </main>
      </>
    );
  }

  const actions: MenuAction[] = [{ label: t("nav.progress"), href: base }];
  if (detail.role.isMember) actions.push({ label: t("menu.rename"), onClick: () => setRenaming(true) });
  if (detail.role.isOwner) actions.push({ label: t("menu.manage"), href: `${base}/manage` });

  const tabs = [
    { href: base, label: t("nav.progress"), icon: "M4 19V9m6 10V5m6 14v-7" },
    { href: `${base}/group`, label: t("nav.group"), icon: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 3-5 6-5s6 2 6 5m2-5c3 0 6 2 6 5" },
    { href: `${base}/rules`, label: t("nav.rules"), icon: "M6 4h9l3 3v13H6zM9 11h6M9 15h6" },
  ];

  return (
    <ChallengeContext.Provider value={{ detail, refresh: load }}>
      <ChallengeHeader title={detail.title} homeHref={base} actions={actions} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5">{children}</main>
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <ul className="mx-auto grid max-w-md grid-cols-3">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {renaming && detail.role.displayName !== null && (
        <RenameDialog
          open
          challengeId={detail.id}
          current={detail.role.displayName}
          onClose={() => setRenaming(false)}
          onSaved={() => {
            setRenaming(false);
            load();
          }}
        />
      )}
    </ChallengeContext.Provider>
  );
}
