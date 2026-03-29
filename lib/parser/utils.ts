/** Parse amount at end of line: -123.45, (123.45), 1,234.56, etc. Returns number (negative for charges). */
export function parseAmount(s: string): number | null {
  const trimmed = s.trim();
  const withParens = /^\(([\d,]+\.?\d*)\)$/.exec(trimmed);
  if (withParens) return -parseFloat(withParens[1].replace(/,/g, ""));
  const normal = /^(-?[\d,]+\.?\d*)$/.exec(trimmed.replace(/^\$/, ""));
  if (normal) return parseFloat(normal[1].replace(/,/g, ""));
  return null;
}
