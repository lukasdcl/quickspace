// summary: Percentages of a number, between two numbers, or added and taken off
//
// Usage:
//   quick pct 15 of 80          15% of 80 is 12
//   quick pct 12 of 80 as a %   or: pct 12 out of 80
//   quick pct 80 to 92          change from 80 to 92 is +15%
//   quick pct 80 + 15           80 plus 15% is 92
//   quick pct 92 - 20           92 less 20%
//   quick pct 92 before 20      the number that 20% was added to, to make 92
//
// A trailing % sign is optional everywhere. Amounts may use commas, a
// leading currency symbol and the suffixes k, m and bn.

const SUFFIXES: Record<string, number> = { "": 1, k: 1e3, m: 1e6, mn: 1e6, bn: 1e9, b: 1e9 };

function num(input: string): number | null {
  const m = input.toLowerCase().replace(/^[£$€]/, "").replaceAll(",", "").replace(/%$/, "")
    .match(/^(-?\d*\.?\d+)([a-z]*)$/);
  if (!m || SUFFIXES[m[2]] === undefined) return null;
  return Number(m[1]) * SUFFIXES[m[2]];
}

function fmt(n: number): string {
  // Small numbers keep more decimals so that 0.0035 doesn't show as 0.
  const digits = Math.abs(n) >= 1 || n === 0 ? 2 : 4;
  return n.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "-"}${fmt(Math.abs(n))}%`;
}

export function answer(input: string): string | null {
  let t = input.toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/^(what is |whats |what's )/, "").replace(/\?$/, "").trim();
  const N = String.raw`([£$€]?-?[\d,]*\.?\d+[a-z]*%?)`;
  let m;

  const asPercent = / as an? ?(%|percentage|percent)$/.test(t);
  t = t.replace(/ as an? ?(%|percentage|percent)$/, "").replace(/\s+%/g, "%");
  if ((m = t.match(new RegExp(`^${N} out of ${N}$`))) || (asPercent && (m = t.match(new RegExp(`^${N} of ${N}$`))))) {
    const a = num(m[1]), b = num(m[2]);
    if (a === null || b === null || b === 0) return null;
    return `${fmt(a)} is ${fmt((100 * a) / b)}% of ${fmt(b)}.`;
  }
  if ((m = t.match(new RegExp(`^${N} of ${N}$`)))) {
    const p = num(m[1]), b = num(m[2]);
    if (p === null || b === null) return null;
    return `${fmt(p)}% of ${fmt(b)} is ${fmt((p * b) / 100)}.`;
  }
  if ((m = t.match(new RegExp(`^(?:from |change from )?${N} (?:to|->) ${N}$`)))) {
    const a = num(m[1]), b = num(m[2]);
    if (a === null || b === null || a === 0) return null;
    const change = ((b - a) / Math.abs(a)) * 100;
    return `From ${fmt(a)} to ${fmt(b)} is ${signed(change)} (${b >= a ? "up" : "down"} ${fmt(Math.abs(b - a))}).`;
  }
  if ((m = t.match(new RegExp(`^${N} ?(\\+|plus|add|-|minus|less|off) ?${N}$`)))) {
    const b = num(m[1]), p = num(m[3]);
    if (b === null || p === null) return null;
    const up = ["+", "plus", "add"].includes(m[2]);
    const result = b * (1 + (up ? p : -p) / 100);
    return `${fmt(b)} ${up ? "plus" : "less"} ${fmt(p)}% is ${fmt(result)} (${up ? "+" : "-"}${fmt(Math.abs(result - b))}).`;
  }
  if ((m = t.match(new RegExp(`^${N} (?:before|without|excluding|ex) ${N}$`)))) {
    const total = num(m[1]), p = num(m[2]);
    if (total === null || p === null || p === -100) return null;
    const base = total / (1 + p / 100);
    return `${fmt(total)} is ${fmt(base)} plus ${fmt(p)}% (${fmt(total - base)}).`;
  }
  return null;
}

function main(args: string[]): void {
  const input = args.join(" ");
  const result = input.trim() ? answer(input) : null;
  if (result === null) {
    if (input.trim()) console.error(`Couldn't work out '${input.trim()}'.`);
    console.error("Try: pct 15 of 80, pct 12 out of 80, pct 80 to 92, pct 80 + 15, pct 92 before 20");
    Deno.exit(1);
  }
  console.log(result);
}

if (import.meta.main) {
  main(Deno.args);
}
