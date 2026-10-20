// summary: Roman numerals to numbers and back
//
// Usage:
//   quick roman 2026          MMXXVI
//   quick roman MCMLXXXIV     1984
//   quick roman 1999 xlii     several at once
//
// Numbers run from 1 to 3999. Numerals written in a non-standard way, such
// as IIII or IM, are read by the usual rule (a smaller symbol before a larger
// one is subtracted) and the standard form is shown alongside.

const TABLE: Array<[number, string]> = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
const VALUE: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function toRoman(n: number): string {
  let out = "";
  for (const [value, symbol] of TABLE) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

export function fromRoman(s: string): number | null {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUE[s[i]], next = VALUE[s[i + 1]] ?? 0;
    if (v === undefined) return null;
    total += v < next ? -v : v;
  }
  return total > 0 ? total : null;
}

function convert(word: string): { line: string; ok: boolean } {
  if (/^\d+$/.test(word)) {
    const n = Number(word);
    if (n < 1 || n > 3999) return { line: `${word}: Roman numerals run from 1 to 3999.`, ok: false };
    return { line: `${word} = ${toRoman(n)}`, ok: true };
  }
  const upper = word.toUpperCase();
  const n = fromRoman(upper);
  if (n === null || n > 3999) return { line: `${word}: not a Roman numeral.`, ok: false };
  const standard = toRoman(n);
  const line = standard === upper ? `${upper} = ${n}` : `${upper} = ${n} (usually written ${standard})`;
  return { line, ok: true };
}

function main(args: string[]): void {
  const words = args.join(" ").split(/[\s,]+/).filter(Boolean);
  if (words.length === 0) {
    console.log(`This year is ${toRoman(new Date().getFullYear())}.`);
    return;
  }
  let failed = false;
  for (const w of words) {
    const { line, ok } = convert(w);
    if (!ok) failed = true;
    console.log(line);
  }
  if (failed) Deno.exit(1);
}

if (import.meta.main) {
  main(Deno.args);
}
