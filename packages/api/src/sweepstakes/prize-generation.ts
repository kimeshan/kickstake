/**
 * Auto prize generation (spec §5).
 *
 * Given a pot (integer minor units) and the tournament's group count G,
 * produce a balanced prize allocation that ALWAYS sums to exactly the pot.
 * Per-group prizes store the PER-GROUP amount; their pot contribution is
 * amount × G. Rounding remainder is absorbed by the Winner so the structure
 * reconciles to the pot to the minor unit.
 */

type RuleType =
  | "winner"
  | "runner_up"
  | "third_place"
  | "group_top"
  | "group_bottom"
  | "player_of_tournament"
  | "golden_boot"
  | "most_cards"
  | "least_conceded"
  | "most_possession"
  | "least_possession"
  | "biggest_loss"
  | "custom";

interface PrizeTemplateItem {
  ruleType: RuleType;
  label: string;
  description: string | null;
  pct: number;
  perGroup: boolean;
}

// Default template (percentages of pot). Sums to 100%.
export const PRIZE_TEMPLATE: PrizeTemplateItem[] = [
  { ruleType: "winner", label: "Tournament Winner", description: "Owner of the team that lifts the trophy.", pct: 0.25, perGroup: false },
  { ruleType: "runner_up", label: "Runner-up", description: "Owner of the team that loses the final.", pct: 0.13, perGroup: false },
  { ruleType: "third_place", label: "Bronze", description: "Owner of the team that wins the 3rd-place playoff.", pct: 0.05, perGroup: false },
  { ruleType: "group_top", label: "Top of group", description: "Owner of the team that finishes 1st in each group — split across all groups.", pct: 0.15, perGroup: true },
  { ruleType: "group_bottom", label: "Bottom of group", description: "Owner of the team that finishes last in each group — split across all groups.", pct: 0.12, perGroup: true },
  { ruleType: "player_of_tournament", label: "Player of the Tournament", description: "Owner of the team whose player wins the official award.", pct: 0.04, perGroup: false },
  { ruleType: "golden_boot", label: "Golden Boot", description: "Owner of the team with the tournament's top scorer.", pct: 0.04, perGroup: false },
  { ruleType: "most_cards", label: "Dirtiest team", description: "Most disciplinary points — 15 per red, 10 per yellow.", pct: 0.04, perGroup: false },
  { ruleType: "least_conceded", label: "Best defence", description: "Team with the lowest average goals conceded.", pct: 0.05, perGroup: false },
  { ruleType: "most_possession", label: "Most possession", description: "Team with the highest average possession.", pct: 0.04, perGroup: false },
  { ruleType: "least_possession", label: "Least possession", description: "Team with the lowest average possession.", pct: 0.04, perGroup: false },
  { ruleType: "biggest_loss", label: "Biggest single-game loss", description: "Team that suffers the heaviest defeat in one match.", pct: 0.05, perGroup: false },
];

export interface GeneratedPrize {
  label: string;
  description: string | null;
  ruleType: RuleType;
  amount: number; // minor units; per-group = amount PER group
  perGroup: boolean;
  enabled: boolean;
}

/** A prize's contribution to the pot total. */
export function prizeContribution(
  prize: { amount: number; perGroup: boolean; enabled: boolean },
  groupCount: number,
): number {
  if (!prize.enabled) return 0;
  return prize.perGroup ? prize.amount * groupCount : prize.amount;
}

/** Sum of all enabled prizes' pot contributions. */
export function prizeTotal(
  prizes: { amount: number; perGroup: boolean; enabled: boolean }[],
  groupCount: number,
): number {
  return prizes.reduce((sum, p) => sum + prizeContribution(p, groupCount), 0);
}

/**
 * Build the default prize structure for a pot. Guaranteed: the result's
 * prizeTotal() equals `pot` exactly.
 */
export function generatePrizes(pot: number, groupCount: number): GeneratedPrize[] {
  const prizes: GeneratedPrize[] = PRIZE_TEMPLATE.map((tpl) => {
    const target = Math.round(tpl.pct * pot);
    const amount = tpl.perGroup ? Math.round(target / groupCount) : target;
    return {
      label: tpl.label,
      description: tpl.description,
      ruleType: tpl.ruleType,
      amount: Math.max(0, amount),
      perGroup: tpl.perGroup,
      enabled: true,
    };
  });

  // Absorb the rounding remainder into the Winner so the sum is exact.
  const diff = pot - prizeTotal(prizes, groupCount);
  const winner = prizes.find((p) => p.ruleType === "winner");
  if (winner) winner.amount += diff;

  return prizes;
}
