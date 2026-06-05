/**
 * Title-cases a person's name for display, regardless of how they typed it
 * ("JOHN", "mary jane", "O'BRIEN" → "John", "Mary Jane", "O'Brien").
 * Word boundaries: spaces, hyphens, apostrophes.
 */
export function titleCaseName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}
