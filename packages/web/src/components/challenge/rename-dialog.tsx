"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { challengeApi, errorKey } from "@/lib/challenge";
import { Dialog } from "./ui";

export function RenameDialog({
  challengeId,
  current,
  open,
  onClose,
  onSaved,
}: {
  challengeId: string;
  current: string;
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const t = useTranslations("challenge.rename");
  const te = useTranslations("challenge.errors");
  const [name, setName] = useState(current);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const r = await challengeApi<{ displayName: string }>(`/${challengeId}/me`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: name }),
      });
      onSaved(r.displayName);
    } catch (err) {
      setError(te(errorKey(err)));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title={t("title")} onRequestClose={onClose}>
      <form onSubmit={save} className="mt-4 space-y-3">
        <label htmlFor="rename-input" className="sr-only">
          {t("title")}
        </label>
        <Input
          id="rename-input"
          autoFocus
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-describedby="rename-hint"
        />
        <p id="rename-hint" className="text-sm text-muted-foreground">
          {t("hint")}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="h-12 w-full rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onClose} className="h-11 w-full text-sm text-muted-foreground">
          {t("cancel")}
        </button>
      </form>
    </Dialog>
  );
}
