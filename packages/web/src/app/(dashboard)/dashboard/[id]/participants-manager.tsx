"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { Participant, Sweepstake } from "../_components";

interface Props {
  sweepstakeId: string;
  currency: string;
  participants: Participant[];
  editable: boolean;
  onChange: (s: Sweepstake) => void;
}

export function ParticipantsManager({
  sweepstakeId,
  currency,
  participants,
  editable,
  onChange,
}: Props) {
  const t = useTranslations("players");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function patch(pid: string, body: Record<string, unknown>) {
    setBusy(pid);
    try {
      const r = await apiFetch(`/sweepstakes/${sweepstakeId}/participants/${pid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChange(await r.json());
    } finally {
      setBusy(null);
    }
  }

  async function remove(pid: string) {
    setBusy(pid);
    try {
      const r = await apiFetch(
        `/sweepstakes/${sweepstakeId}/participants/${pid}`,
        { method: "DELETE" },
      );
      onChange(await r.json());
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {t("title")} · {participants.length}
      </h2>
      {participants.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              {editable ? (
                <input
                  defaultValue={p.displayName}
                  disabled={busy === p.id}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== p.displayName) patch(p.id, { displayName: v });
                  }}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-medium outline-none focus:bg-secondary/40"
                  aria-label={t("name")}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.displayName}
                </span>
              )}

              <button
                onClick={() => editable && patch(p.id, { paid: !p.paid })}
                disabled={!editable || busy === p.id}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                  p.paid
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground"
                } ${editable ? "cursor-pointer" : "cursor-default"}`}
              >
                {p.paid ? t("paid") : formatMoney(p.amountDue, currency)}
              </button>

              {editable &&
                (confirming === p.id ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => remove(p.id)}
                      disabled={busy === p.id}
                      className="rounded-lg bg-destructive/20 px-2 py-1 text-xs font-semibold text-destructive"
                    >
                      {t("confirmRemove")}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="rounded-lg px-2 py-1 text-xs text-muted-foreground"
                    >
                      {t("cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirming(p.id)}
                    disabled={busy === p.id}
                    aria-label={t("remove")}
                    className="shrink-0 rounded-lg px-1.5 text-muted-foreground transition hover:text-destructive"
                  >
                    ✕
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
