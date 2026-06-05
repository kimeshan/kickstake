"use client";

import { useTranslations } from "next-intl";

export interface Prize {
  id: string;
  label: string;
  description: string | null;
  ruleType: string;
  amount: number;
  perGroup: boolean;
  enabled: boolean;
}

export interface Sweepstake {
  id: string;
  name: string;
  status: "draft" | "open" | "drawn" | "live" | "settled";
  currency: string;
  buyIn: number;
  donation: number;
  designedPot: number;
  joinToken: string;
  tournament?: { name: string; groupCount: number };
  prizeCategories?: Prize[];
  participants?: { id: string }[];
}

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/15 text-muted-foreground",
  open: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  drawn: "border-sky-300/30 bg-sky-300/10 text-sky-300",
  live: "border-primary/30 bg-primary/10 text-primary",
  settled: "border-primary/30 bg-primary/10 text-primary",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
        STATUS_STYLES[status] ?? STATUS_STYLES.draft
      }`}
    >
      {t(status as "draft")}
    </span>
  );
}
