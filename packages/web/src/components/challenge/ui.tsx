"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatDateRange, MEDAL_STYLES, type Medal, type WeekResult } from "@/lib/challenge";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("grid place-items-center py-16", className)} role="status">
      <div className="size-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none" />
      <span className="sr-only">…</span>
    </div>
  );
}

/** A designed empty/error state — never a raw API error. */
export function StateCard({
  message,
  action,
  tone = "muted",
}: {
  message: string;
  action?: { label: string; href?: string; onClick?: () => void };
  tone?: "muted" | "warn";
}) {
  return (
    <div
      role={tone === "warn" ? "alert" : undefined}
      className={cn(
        "rounded-2xl border p-6 text-center",
        tone === "warn"
          ? "border-destructive/30 bg-destructive/10 text-foreground"
          : "border-border bg-card/60 text-muted-foreground",
      )}
    >
      <p className="text-pretty">{message}</p>
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-border px-5 font-semibold text-foreground"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}

/** "Level 2 · Bronze" pill; text label always accompanies the colour. */
export function LevelBadge({
  level,
  medal,
  size = "md",
}: {
  level: number;
  medal: Medal;
  size?: "sm" | "md";
}) {
  const t = useTranslations("challenge");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        MEDAL_STYLES[medal],
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {level === 0 ? (
        <>
          {t("level", { level: 0 })} · {t("building")}
        </>
      ) : (
        <>
          {t("level", { level })} · {t(`medal.${medal}`)}
        </>
      )}
    </span>
  );
}

export function ResultBadge({ result, size }: { result: WeekResult | null; size?: "sm" | "md" }) {
  const t = useTranslations("challenge");
  if (!result)
    return (
      <span className={cn("text-muted-foreground", size === "sm" ? "text-xs" : "text-sm")}>
        {t("notEntered")}
      </span>
    );
  return <LevelBadge level={result.level} medal={result.medal} size={size} />;
}

export function BaselineBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function InProgressTag() {
  const t = useTranslations("challenge");
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
      {t("inProgress")}
    </span>
  );
}

/** Direction-aware chevron: "prev" points toward the reading start (mirrors in RTL). */
function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** Compact "‹ Week 1 · 21–27 Sep ›" selector. */
export function WeekPicker({
  weeks,
  value,
  onChange,
}: {
  weeks: { weekNumber: number; startDate: string; endDate: string }[];
  value: number;
  onChange: (n: number) => void;
}) {
  const t = useTranslations("challenge");
  const tp = useTranslations("challenge.progress");
  const locale = useLocale();
  const w = weeks[value - 1];
  const btn =
    "grid size-11 shrink-0 place-items-center rounded-xl border border-border text-lg text-foreground transition hover:bg-secondary disabled:opacity-30";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={tp("selectWeek")}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={tp("previousWeek")}
      >
        <Chevron dir="prev" />
      </button>
      <div className="min-w-0 flex-1 text-center font-semibold" aria-live="polite">
        {w ? t("weekRange", { n: w.weekNumber, range: formatDateRange(w.startDate, w.endDate, locale) }) : null}
      </div>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= weeks.length}
        aria-label={tp("nextWeek")}
      >
        <Chevron dir="next" />
      </button>
    </div>
  );
}

/**
 * Modal panel: full-height on phones with content anchored at the top so the
 * input and Save stay above the on-screen keyboard; centred card on desktop.
 */
export function Dialog({
  open,
  title,
  onRequestClose,
  children,
}: {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("challenge");
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRequestClose();
      if (e.key === "Tab" && ref.current) {
        // Keep focus inside the dialog.
        const focusable = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onRequestClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="h-dvh w-full overflow-y-auto bg-card px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:h-auto sm:max-h-[90dvh] sm:max-w-md sm:rounded-3xl sm:border sm:border-border sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="dialog-title" className="font-display text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onRequestClose}
            className="grid size-11 place-items-center rounded-xl text-2xl text-muted-foreground hover:text-foreground"
            aria-label={t("close")}
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Refetch when the tab regains focus and every few minutes (week rollover, others' saves). */
export function useRefreshOnFocus(refresh: () => void, intervalMs = 5 * 60_000) {
  const cb = useRef(refresh);
  useEffect(() => {
    cb.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") cb.current();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    const id = window.setInterval(run, intervalMs);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
      window.clearInterval(id);
    };
  }, [intervalMs]);
}

/** Tracks navigator.onLine. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [setOnline]);
  return online;
}

/** A counter to re-run a fetch effect: `[nonce, reload]`. */
export function useReload(): [number, () => void] {
  const [nonce, setNonce] = useState(0);
  return [nonce, useCallback(() => setNonce((n) => n + 1), [])];
}
