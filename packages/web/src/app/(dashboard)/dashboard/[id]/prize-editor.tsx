"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import {
  formatMoney,
  toMinor,
  fromMinor,
  currencySymbol,
} from "@/lib/money";
import { Input } from "@/components/ui/input";
import type { Prize } from "../_components";

interface Props {
  sweepstakeId: string;
  currency: string;
  groupCount: number;
  designedPot: number;
  prizes: Prize[];
  editable: boolean;
  onSaved: (prizes: Prize[]) => void;
}

type Row = Omit<Prize, "id"> & { id?: string };

const contribution = (r: Row, g: number) =>
  r.enabled ? (r.perGroup ? r.amount * g : r.amount) : 0;

export function PrizeEditor({
  sweepstakeId,
  currency,
  groupCount,
  designedPot,
  prizes,
  editable,
  onSaved,
}: Props) {
  const t = useTranslations("prizeEditor");
  const td = useTranslations("detail");
  const pt = useTranslations("prizeTypes");
  // Standard prizes are translated by rule type; custom prizes use the
  // organiser's own text.
  const labelOf = (p: { ruleType: string; label: string }) =>
    p.ruleType === "custom" ? p.label : pt(`${p.ruleType}.label`);
  const descOf = (p: { ruleType: string; description: string | null }) =>
    p.ruleType === "custom" ? p.description : pt(`${p.ruleType}.description`);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(prizes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allocated = rows.reduce((s, r) => s + contribution(r, groupCount), 0);
  const diff = designedPot - allocated;
  const balanced = diff === 0;

  function start() {
    setRows(prizes.map((p) => ({ ...p })));
    setError(null);
    setEditing(true);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addPrize() {
    setRows((rs) => [
      ...rs,
      {
        label: "",
        description: null,
        ruleType: "custom",
        amount: 0,
        perGroup: false,
        enabled: true,
      },
    ]);
  }

  function autoBalance() {
    // Dump the remaining difference into the first enabled non-per-group prize.
    const i = rows.findIndex((r) => r.enabled && !r.perGroup);
    if (i === -1) return;
    update(i, { amount: Math.max(0, rows[i].amount + diff) });
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/sweepstakes/${sweepstakeId}/prizes`, {
        method: "PUT",
        body: JSON.stringify({
          prizes: rows.map((r) => ({
            label: r.label.trim(),
            description: r.description,
            ruleType: r.ruleType,
            amount: r.amount,
            perGroup: r.perGroup,
            enabled: r.enabled,
          })),
        }),
      });
      const updated = await res.json();
      onSaved(updated.prizeCategories as Prize[]);
      setEditing(false);
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  // ---- Read mode ----
  if (!editing) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {td("prizes")}
          </h2>
          {editable && (
            <button
              onClick={start}
              className="text-sm font-medium text-primary transition hover:opacity-80"
            >
              {t("edit")}
            </button>
          )}
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
          {prizes
            .filter((p) => p.enabled)
            .map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{labelOf(p)}</div>
                  {descOf(p) && (
                    <div className="text-xs text-muted-foreground">
                      {descOf(p)}
                    </div>
                  )}
                  {p.perGroup && (
                    <div className="text-xs text-primary/80">
                      {t("perGroup", { count: groupCount })}
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-display text-lg">
                  {formatMoney(p.amount, currency)}
                </span>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  // ---- Edit mode ----
  const symbol = currencySymbol(currency);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {td("prizes")}
        </h2>
        <button
          onClick={() => setEditing(false)}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {t("cancel")}
        </button>
      </div>

      {/* Reconciliation bar */}
      <div className="mb-3 rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("allocated")}</span>
          <span className={balanced ? "font-semibold text-primary" : "font-semibold text-destructive"}>
            {formatMoney(allocated, currency)} / {formatMoney(designedPot, currency)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary/60">
          <div
            className={`h-full rounded-full ${balanced ? "bg-primary" : "bg-destructive"}`}
            style={{
              width: `${Math.min(100, designedPot ? (allocated / designedPot) * 100 : 0)}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {balanced
              ? `✓ ${t("balanced")}`
              : diff < 0
                ? t("over", { amount: formatMoney(-diff, currency) })
                : t("under", { amount: formatMoney(diff, currency) })}
          </span>
          {!balanced && (
            <button
              onClick={autoBalance}
              className="text-xs font-medium text-primary transition hover:opacity-80"
            >
              {t("autoBalance")}
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.id ?? `new-${i}`}
            className={`rounded-2xl border border-border bg-card/40 p-3 ${r.enabled ? "" : "opacity-50"}`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
                aria-label="enabled"
              />
              {r.ruleType === "custom" ? (
                <Input
                  value={r.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder={t("namePlaceholder")}
                  className="h-9 flex-1"
                />
              ) : (
                <span className="flex h-9 min-w-0 flex-1 items-center truncate px-1 text-sm font-medium">
                  {labelOf(r)}
                </span>
              )}
              <div className="relative w-28 shrink-0">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {symbol}
                </span>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={fromMinor(r.amount, currency)}
                  onChange={(e) =>
                    update(i, { amount: toMinor(Number(e.target.value), currency) })
                  }
                  className="h-9 pl-7 text-right"
                />
              </div>
              <button
                onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                aria-label={t("remove")}
                className="shrink-0 rounded-lg px-2 py-1 text-muted-foreground transition hover:text-destructive"
              >
                ✕
              </button>
            </div>
            {r.ruleType === "custom" ? (
              <Input
                value={r.description ?? ""}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder={t("descPlaceholder")}
                className="mt-2 h-8 text-xs"
              />
            ) : (
              descOf(r) && (
                <p className="mt-1.5 px-1 text-xs text-muted-foreground">
                  {descOf(r)}
                </p>
              )
            )}
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              {r.perGroup && <span>{t("perGroup", { count: groupCount })}</span>}
              {r.ruleType === "custom" && <span>{t("manual")}</span>}
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={addPrize}
        className="mt-3 w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
      >
        {t("add")}
      </button>

      {error && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={!balanced || saving || rows.length === 0}
        className="mt-3 w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-50"
      >
        {saving ? t("saving") : t("save")}
      </button>
    </div>
  );
}
