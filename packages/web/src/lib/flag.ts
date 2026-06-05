/** Best-effort flag emoji from an ISO-ish code (e.g. "br", "gb-eng"). */
export function flagEmoji(code?: string | null): string {
  if (!code) return "🏳️";
  const c = code.toLowerCase();
  if (/^[a-z]{2}$/.test(c)) {
    return String.fromCodePoint(
      ...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 97),
    );
  }
  if (c === "gb-eng") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (c === "gb-sct") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  if (c === "gb-wls") return "🏴󠁧󠁢󠁷󠁬󠁳󠁿";
  return "🏳️";
}
