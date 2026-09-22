"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  ChallengeApiError,
  challengeApi,
  copyText,
  errorKey,
  formatDateRange,
  formatInstant,
  formatNumber,
  parseMinutesInput,
  type ManageMember,
  type ManageView,
  type WeekSummary,
} from "@/lib/challenge";
import { apiUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { useChallenge } from "@/components/challenge/context";
import { Spinner, StateCard, WeekPicker, useReload } from "@/components/challenge/ui";

const card = "rounded-3xl border border-border bg-card/60 p-4";
const heading = "mb-3 text-sm font-bold uppercase tracking-widest text-muted-foreground";
const btn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition disabled:opacity-50";

export default function ManagePage() {
  const { detail, refresh } = useChallenge();
  const t = useTranslations("challenge.manage");
  const tc = useTranslations("challenge");
  const [view, setView] = useState<ManageView | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, reload] = useReload();

  useEffect(() => {
    if (!detail.role.isOwner) return;
    let live = true;
    challengeApi<ManageView>(`/${detail.id}/manage`)
      .then((v) => live && setView(v))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ChallengeApiError && e.status === 401) return refresh();
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [detail.id, detail.role.isOwner, nonce, refresh]);

  if (!detail.role.isOwner) return <StateCard message={tc("errors.not_organiser")} />;
  if (!view)
    return failed ? (
      <StateCard message={tc("states.error")} action={{ label: tc("retry"), onClick: reload }} />
    ) : (
      <Spinner />
    );

  // Every organiser mutation returns the fresh manage view.
  const onChange = (v: ManageView) => {
    setView(v);
    refresh();
  };
  const active = view.members.filter((m) => !m.removedAt);
  const removed = view.members.filter((m) => m.removedAt);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <div className="space-y-4">
          <InvitationCard view={view} onChange={onChange} />
          <SettingsCard view={view} onChange={onChange} />
          <SummaryCard view={view} />
          <section className={card} aria-labelledby="export-h">
            <h2 id="export-h" className={heading}>
              {t("exportTitle")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{t("exportHint")}</p>
            <a href={apiUrl(`/challenges/${view.id}/export.csv`)} download className={btn}>
              {t("exportCsv")}
            </a>
          </section>
        </div>
        <section aria-labelledby="roster-h" className="space-y-2">
          <h2 id="roster-h" className={heading}>
            {t("rosterTitle", { count: active.length })}
          </h2>
          {active.length === 0 && <StateCard message={t("rosterEmpty")} />}
          {active.map((m) => (
            <MemberCard key={m.memberId} view={view} member={m} onChange={onChange} onConflict={reload} />
          ))}
          {removed.length > 0 && (
            <>
              <h3 className={cn(heading, "mt-6")}>{t("removedTitle", { count: removed.length })}</h3>
              {removed.map((m) => (
                <MemberCard key={m.memberId} view={view} member={m} onChange={onChange} onConflict={reload} />
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function InvitationCard({ view, onChange }: { view: ManageView; onChange: (v: ManageView) => void }) {
  const t = useTranslations("challenge.manage");
  const te = useTranslations("challenge.errors");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setPending(true);
    setError(null);
    try {
      onChange(await challengeApi<ManageView>(`/${view.id}/invitation/rotate`, { method: "POST" }));
      setConfirming(false);
    } catch (e) {
      setError(te(errorKey(e)));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={card} aria-labelledby="invite-h">
      <h2 id="invite-h" className={heading}>
        {t("inviteTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("inviteHint")}</p>
      <p className="break-all rounded-xl bg-secondary/60 p-3 font-mono text-sm" data-testid="invite-url">
        {view.invitationUrl}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          onClick={async () => {
            setCopied(await copyText(view.invitationUrl));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? t("copied") : t("copyLink")}
        </button>
        {!confirming ? (
          <button type="button" className={btn} onClick={() => setConfirming(true)}>
            {t("rotate")}
          </button>
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
      {confirming && (
        <div role="alertdialog" aria-labelledby="rotate-q" className="mt-3 space-y-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
          <p id="rotate-q" className="text-sm">{t("rotateConfirm")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cn(btn, "border-destructive/40 text-destructive")} onClick={rotate} disabled={pending}>
              {t("rotateYes")}
            </button>
            <button type="button" className={btn} onClick={() => setConfirming(false)} disabled={pending}>
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <div className="font-semibold">{label}</div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-8 w-14 shrink-0 rounded-full border transition disabled:opacity-50",
          checked ? "border-primary bg-primary" : "border-border bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-6 rounded-full transition-all motion-reduce:transition-none",
            checked ? "start-7 bg-primary-foreground" : "start-1 bg-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}

function SettingsCard({ view, onChange }: { view: ManageView; onChange: (v: ManageView) => void }) {
  const t = useTranslations("challenge.manage");
  const te = useTranslations("challenge.errors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, boolean>) {
    setPending(true);
    setError(null);
    try {
      onChange(await challengeApi<ManageView>(`/${view.id}/settings`, { method: "PATCH", body: JSON.stringify(body) }));
    } catch (e) {
      setError(te(errorKey(e)));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={card} aria-labelledby="settings-h">
      <h2 id="settings-h" className={heading}>
        {t("settingsTitle")}
      </h2>
      <Toggle
        label={t("joiningOpen")}
        hint={t("joiningOpenHint")}
        checked={!view.joiningClosed}
        disabled={pending}
        onToggle={() => patch({ joiningClosed: !view.joiningClosed })}
      />
      <Toggle
        label={t("editingOpen")}
        hint={t("editingOpenHint", { time: formatInstant(view.finalEditCutoff, locale, view.timeZone) })}
        checked={!view.participantEditingLocked}
        disabled={pending}
        onToggle={() => patch({ participantEditingLocked: !view.participantEditingLocked })}
      />
      {!view.timing.beforeCutoff && <p className="mt-2 text-sm text-muted-foreground">{t("pastCutoff")}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}

function SummaryCard({ view }: { view: ManageView }) {
  const t = useTranslations("challenge.manage");
  const tc = useTranslations("challenge");
  const locale = useLocale();
  const [week, setWeek] = useState(view.timing.defaultWeek);
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    challengeApi<WeekSummary>(`/${view.id}/summary?week=${week}`)
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
    // Re-read whenever the roster changes (a correction, a removal).
  }, [view, week]);

  const fmt = (n: number) => formatNumber(n, locale);
  const text = summary
    ? [
        t("summaryHeader", {
          title: summary.title,
          n: summary.weekNumber,
          range: formatDateRange(summary.startDate, summary.endDate, locale),
        }),
        summary.inProgress ? t("summaryInProgress") : null,
        t("summaryTotal", { minutes: fmt(summary.groupMinutes) }),
        t("summaryBaseline", {
          done: summary.atBaselineCount,
          total: summary.activeCount,
          count: summary.baselineMinutes,
        }),
        ...view.ladder
          .filter((r) => (summary.levelCounts[r.level] ?? 0) > 0)
          .reverse()
          .map((r) =>
            t("summaryLevel", {
              level: r.level === 0 ? `${tc("level", { level: 0 })} · ${tc("building")}` : `${tc("level", { level: r.level })} · ${tc(`medal.${r.medal}`)}`,
              count: summary.levelCounts[r.level],
            }),
          ),
        t("summaryMissing", { count: summary.notEnteredCount }),
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return (
    <section className={card} aria-labelledby="summary-h">
      <h2 id="summary-h" className={heading}>
        {t("summaryTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("summaryHint")}</p>
      <WeekPicker weeks={view.timing.weeks} value={week} onChange={setWeek} />
      <label htmlFor="summary-text" className="sr-only">
        {t("summaryTitle")}
      </label>
      <textarea
        id="summary-text"
        readOnly
        value={text}
        rows={Math.max(6, text.split("\n").length)}
        className="mt-3 w-full resize-none rounded-xl border border-input bg-secondary/40 p-3 text-sm"
      />
      <button
        type="button"
        className={cn(btnPrimary, "mt-2")}
        disabled={!summary}
        onClick={async () => {
          setCopied(await copyText(text));
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t("copied") : t("copySummary")}
      </button>
    </section>
  );
}

function MemberCard({
  view,
  member,
  onChange,
  onConflict,
}: {
  view: ManageView;
  member: ManageMember;
  onChange: (v: ManageView) => void;
  onConflict: () => void;
}) {
  const t = useTranslations("challenge.manage");
  const tc = useTranslations("challenge");
  const te = useTranslations("challenge.errors");
  const locale = useLocale();
  const started = view.timing.weeks.filter((w) => w.status !== "future");
  const [week, setWeek] = useState(started.length ? started[started.length - 1].weekNumber : 1);
  const [minutes, setMinutes] = useState("");
  const [clear, setClear] = useState(false);
  const [reason, setReason] = useState("");
  const [name, setName] = useState(member.displayName);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const parsed = parseMinutesInput(minutes);
  const removed = !!member.removedAt;

  async function call(path: string, method: string, body: unknown, ok: string) {
    setPending(true);
    setMessage(null);
    try {
      onChange(await challengeApi<ManageView>(path, { method, body: JSON.stringify(body) }));
      setMessage({ tone: "ok", text: ok });
      return true;
    } catch (e) {
      if (e instanceof ChallengeApiError && e.code === "version_conflict") onConflict();
      setMessage({ tone: "err", text: te(errorKey(e)) });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function correct(e: React.FormEvent) {
    e.preventDefault();
    const row = member.weeks.find((w) => w.weekNumber === week);
    if (!row) return;
    if (!clear && !parsed.ok) return setMessage({ tone: "err", text: te("invalid_minutes") });
    const done = await call(
      `/${view.id}/members/${member.memberId}/weeks/${week}`,
      "PUT",
      { minutes: clear ? null : parsed.ok ? parsed.value : null, expectedVersion: row.version, reason },
      t("corrected"),
    );
    if (done) {
      setMinutes("");
      setReason("");
      setClear(false);
    }
  }

  return (
    <details className={cn("group rounded-2xl border bg-card/60", removed ? "border-border opacity-70" : "border-border")}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-semibold" dir="auto">
              {member.displayName}
            </span>
            {removed && (
              <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
                {t("removedBadge")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {view.timing.weeks.map((w) => {
              const row = member.weeks.find((r) => r.weekNumber === w.weekNumber);
              const missing = w.status !== "future" && (row?.minutes ?? null) === null;
              return (
                <span
                  key={w.weekNumber}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs",
                    missing ? "bg-[#f2c94c]/15 text-[#f2c94c]" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {t("weekShort", { n: w.weekNumber })}{" "}
                  {w.status === "future" ? "–" : row?.minutes === null || row?.minutes === undefined ? t("missing") : fmtMin(row.minutes)}
                  {row?.updateSource === "organiser" ? " *" : ""}
                </span>
              );
            })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {member.lastUpdatedAt
              ? t("lastUpdate", { time: formatInstant(member.lastUpdatedAt, locale, view.timeZone) })
              : t("neverUpdated")}
          </div>
        </div>
        <span aria-hidden className="text-muted-foreground transition group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="space-y-4 border-t border-border p-3">
        {!removed && (
          <form onSubmit={correct} className="space-y-2" aria-label={t("correctTitle")}>
            <h4 className="font-semibold">{t("correctTitle")}</h4>
            <label className="block text-sm" htmlFor={`wk-${member.memberId}`}>
              {t("week")}
            </label>
            <select
              id={`wk-${member.memberId}`}
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="h-12 w-full rounded-xl border border-input bg-secondary/40 px-3 text-base"
            >
              {started.map((w) => (
                <option key={w.weekNumber} value={w.weekNumber} className="bg-card">
                  {tc("weekRange", { n: w.weekNumber, range: formatDateRange(w.startDate, w.endDate, locale) })}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t("currentValue", {
                value: (() => {
                  const v = member.weeks.find((r) => r.weekNumber === week)?.minutes ?? null;
                  return v === null ? tc("notEntered") : tc("minutes", { count: v });
                })(),
              })}
            </p>
            <label className="block text-sm" htmlFor={`min-${member.memberId}`}>
              {t("newMinutes")}
            </label>
            <Input
              id={`min-${member.memberId}`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              disabled={clear}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={clear} onChange={(e) => setClear(e.target.checked)} className="size-5" />
              {t("clearEntry")}
            </label>
            <label className="block text-sm" htmlFor={`why-${member.memberId}`}>
              {t("reason")}
            </label>
            <Input
              id={`why-${member.memberId}`}
              value={reason}
              maxLength={500}
              placeholder={t("reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
            <button type="submit" className={btnPrimary} disabled={pending || !reason.trim() || (!clear && !parsed.ok) || !started.length}>
              {t("saveCorrection")}
            </button>
          </form>
        )}

        {!removed && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              call(`/${view.id}/members/${member.memberId}`, "PATCH", { displayName: name }, t("renamed"));
            }}
          >
            <label className="block text-sm font-semibold" htmlFor={`name-${member.memberId}`}>
              {t("displayName")}
            </label>
            <div className="flex gap-2">
              <Input id={`name-${member.memberId}`} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
              <button type="submit" className={btn} disabled={pending || !name.trim() || name.trim() === member.displayName}>
                {t("rename")}
              </button>
            </div>
          </form>
        )}

        {removed ? (
          <button
            type="button"
            className={btn}
            disabled={pending}
            onClick={() => call(`/${view.id}/members/${member.memberId}`, "PATCH", { removed: false }, t("restored"))}
          >
            {t("restore")}
          </button>
        ) : !confirmRemove ? (
          <button type="button" className={cn(btn, "text-destructive")} onClick={() => setConfirmRemove(true)}>
            {t("remove")}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby={`rm-${member.memberId}`} className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
            <p id={`rm-${member.memberId}`} className="text-sm">
              {t("removeConfirm", { name: member.displayName })}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(btn, "border-destructive/40 text-destructive")}
                disabled={pending}
                onClick={() => call(`/${view.id}/members/${member.memberId}`, "PATCH", { removed: true }, t("removedDone"))}
              >
                {t("removeYes")}
              </button>
              <button type="button" className={btn} onClick={() => setConfirmRemove(false)}>
                {t("cancel")}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role={message.tone === "err" ? "alert" : "status"} className={cn("text-sm", message.tone === "err" ? "text-destructive" : "text-primary")}>
            {message.text}
          </p>
        )}
      </div>
    </details>
  );

  function fmtMin(n: number) {
    return tc("min", { count: formatNumber(n, locale) });
  }
}
