"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";

/** "Don't see your tournament? Request one." Emails hello@kickstake.app. */
export function RequestTournament({ className }: { className?: string }) {
  const t = useTranslations("support");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await apiFetch("/support/tournament-request", {
        method: "POST",
        body: JSON.stringify({ tournamentName: name.trim(), email: email.trim(), note }),
      });
      setDone(true);
    } catch {
      setError(t("error"));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p className={`text-sm text-primary ${className ?? ""}`}>{t("success")}</p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`text-sm font-medium text-primary transition hover:opacity-80 ${className ?? ""}`}
      >
        {t("cantFind")}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-2 rounded-2xl border border-border bg-card/50 p-4 text-left ${className ?? ""}`}
    >
      <div className="text-sm font-semibold">{t("title")}</div>
      <Input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        className="h-10"
      />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className="h-10"
      />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        className="h-10"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={sending || !name.trim()}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {sending ? t("sending") : t("submit")}
        </button>
      </div>
    </form>
  );
}
