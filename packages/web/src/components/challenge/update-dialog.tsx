"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  ChallengeApiError,
  NetworkError,
  challengeApi,
  errorKey,
  formatDateRange,
  formatNumber,
  hoursAndMinutes,
  parseMinutesInput,
  type MyProgress,
  type MyWeek,
} from "@/lib/challenge";
import { Dialog, useOnline } from "./ui";

type Step = "edit" | "confirmBig" | "confirmClear" | "confirmDiscard";

/**
 * The critical interaction: replace one week's total. Never reports success
 * before the server acknowledges; a failed save keeps the typed value; a
 * stale write surfaces the server's latest total for review.
 */
export function UpdateDialog({
  challengeId,
  week,
  timeZone,
  onClose,
  onSaved,
}: {
  challengeId: string;
  week: MyWeek;
  timeZone: string;
  onClose: () => void;
  /** `progress` is null when the save landed but the re-read failed — reload. */
  onSaved: (progress: MyProgress | null, minutes: number | null) => void;
}) {
  const t = useTranslations("challenge.update");
  const tc = useTranslations("challenge");
  const te = useTranslations("challenge.errors");
  const locale = useLocale();
  const online = useOnline();
  const initial = week.minutes === null ? "" : String(week.minutes);
  const [value, setValue] = useState(initial);
  const [baseVersion, setBaseVersion] = useState(week.version);
  const [serverMinutes, setServerMinutes] = useState<number | null>(week.minutes);
  const [step, setStep] = useState<Step>("edit");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ minutes: number | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dirty = value.trim() !== initial;
  const parsed = parseMinutesInput(value);
  const range = formatDateRange(week.startDate, week.endDate, locale);
  const fmtMin = (n: number) => tc("minutes", { count: n });

  // Warn before a reload/close throws away a typed-but-unsaved total.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const validation =
    !parsed.ok && (parsed.reason !== "empty" || submitted)
      ? parsed.reason === "empty"
        ? t("errEmpty")
        : parsed.reason === "format"
          ? t("errFormat")
          : t("errRange")
      : null;

  function requestClose() {
    if (pending) return;
    if (dirty && step !== "confirmDiscard") return setStep("confirmDiscard");
    onClose();
  }

  async function reread(): Promise<MyProgress> {
    return challengeApi<MyProgress>(`/${challengeId}/me`);
  }

  async function submit(minutes: number | null) {
    setPending(true);
    setError(null);
    setConflict(null);
    try {
      const p = await challengeApi<MyProgress>(`/${challengeId}/me/weeks/${week.weekNumber}`, {
        method: "PUT",
        body: JSON.stringify({ minutes, expectedVersion: baseVersion }),
      });
      onSaved(p, minutes);
    } catch (e) {
      if (e instanceof ChallengeApiError && e.code === "version_conflict") {
        const current = e.body.current as { minutes: number | null; version: number };
        if (current.minutes === minutes) {
          // An earlier (retried) attempt already landed — that IS our save.
          onSaved(await reread().catch(() => null), minutes);
          return;
        }
        setBaseVersion(current.version);
        setServerMinutes(current.minutes);
        setConflict({ minutes: current.minutes });
      } else if (e instanceof NetworkError) {
        setError(t("notSaved", { reason: te("network") }));
        // The request may or may not have reached the server: re-read the
        // saved total rather than guessing (never add, never assume).
        reread()
          .then((p) => {
            const w = p.weeks[week.weekNumber - 1];
            if (w.version === baseVersion) return;
            if (w.minutes === minutes) onSaved(p, minutes);
            else {
              setBaseVersion(w.version);
              setServerMinutes(w.minutes);
              setConflict({ minutes: w.minutes });
            }
          })
          .catch(() => {});
      } else {
        setError(t("notSaved", { reason: te(errorKey(e)) }));
      }
      setStep("edit");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!parsed.ok) {
      inputRef.current?.focus();
      return;
    }
    if (parsed.value > 1000 && step !== "confirmBig") return setStep("confirmBig");
    submit(parsed.value);
  }

  const btnPrimary =
    "h-14 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground transition active:scale-[.98] disabled:opacity-50";
  const btnSecondary =
    "h-12 w-full rounded-2xl border border-border font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50";

  return (
    <Dialog open title={t("title")} onRequestClose={requestClose}>
      <p className="mt-1 text-sm text-muted-foreground">
        {tc("weekRange", { n: week.weekNumber, range })} · {t("timeZone", { tz: timeZone })}
      </p>

      {step === "confirmDiscard" ? (
        <div className="mt-6 space-y-3" role="alertdialog" aria-labelledby="discard-q">
          <p id="discard-q" className="text-lg font-semibold">{t("discard")}</p>
          <button type="button" className={btnSecondary} onClick={() => setStep("edit")} autoFocus>
            {t("keepEditing")}
          </button>
          <button type="button" className="h-12 w-full rounded-2xl font-semibold text-destructive" onClick={onClose}>
            {t("discardYes")}
          </button>
        </div>
      ) : step === "confirmClear" ? (
        <div className="mt-6 space-y-3" role="alertdialog" aria-labelledby="clear-q">
          <p id="clear-q" className="text-lg font-semibold">{t("clearConfirm")}</p>
          <button
            type="button"
            className="h-12 w-full rounded-2xl bg-destructive/15 font-semibold text-destructive disabled:opacity-50"
            onClick={() => submit(null)}
            disabled={pending || !online}
            autoFocus
          >
            {pending ? t("saving") : t("clearYes")}
          </button>
          <button type="button" className={btnSecondary} onClick={() => setStep("edit")} disabled={pending}>
            {t("keep")}
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-3" noValidate>
          <label htmlFor="minutes-input" className="block text-base font-semibold">
            {t("label")}
          </label>
          <p id="minutes-helper" className="text-sm text-muted-foreground">
            {t("helper")}
          </p>
          <p className="text-sm">
            {serverMinutes === null
              ? t("currentNone")
              : t("current", { minutes: fmtMin(serverMinutes) })}
          </p>
          <Input
            id="minutes-input"
            ref={inputRef}
            autoFocus
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            autoComplete="off"
            placeholder={t("placeholder")}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (step === "confirmBig") setStep("edit");
            }}
            aria-invalid={!!validation}
            aria-describedby={`minutes-helper${validation ? " minutes-error" : ""}`}
            className="h-16 text-center font-display text-4xl tracking-wide"
          />
          {validation && (
            <p id="minutes-error" role="alert" className="text-sm text-destructive">
              {validation}
            </p>
          )}

          {conflict && (
            <p role="alert" className="rounded-xl border border-[#f2c94c]/40 bg-[#f2c94c]/10 px-3 py-2 text-sm">
              {conflict.minutes === null
                ? t("conflictNone")
                : t("conflict", { minutes: fmtMin(conflict.minutes) })}
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {!online && (
            <p role="status" className="text-sm text-[#f2c94c]">
              {tc("offline")}
            </p>
          )}

          {step === "confirmBig" && parsed.ok ? (
            <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3" role="alertdialog" aria-labelledby="big-q">
              <p id="big-q" className="font-semibold">
                {t("bigConfirm", {
                  minutes: fmtMin(parsed.value),
                  duration: tc("hoursMinutes", {
                    h: formatNumber(hoursAndMinutes(parsed.value).h, locale),
                    m: formatNumber(hoursAndMinutes(parsed.value).m, locale),
                  }),
                })}
              </p>
              <button type="submit" className={btnPrimary} disabled={pending || !online} autoFocus>
                {pending ? t("saving") : t("bigYes")}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={pending}
                onClick={() => {
                  setStep("edit");
                  inputRef.current?.focus();
                }}
              >
                {t("bigNo")}
              </button>
            </div>
          ) : (
            <button type="submit" className={btnPrimary} disabled={pending || !online}>
              {pending ? t("saving") : t("save")}
            </button>
          )}

          <button type="button" className="h-11 w-full text-sm text-muted-foreground" onClick={requestClose} disabled={pending}>
            {t("cancel")}
          </button>
          {serverMinutes !== null && (
            <button
              type="button"
              className="h-11 w-full text-sm font-medium text-destructive disabled:opacity-50"
              onClick={() => setStep("confirmClear")}
              disabled={pending}
            >
              {t("clear")}
            </button>
          )}
        </form>
      )}
    </Dialog>
  );
}
