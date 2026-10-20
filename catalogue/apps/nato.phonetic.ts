// summary: Spell something out in the phonetic alphabet
//
// Usage:
//   quick nato AB12 CDE        a number plate
//   quick nato luke@example.com
//   quick nato                 the whole alphabet
//
// The official spellings are Alfa and Juliett, chosen so that speakers of
// other languages say them correctly. This prints Alpha and Juliet because
// it is read out loud by English speakers. Capital letters come out in
// capitals, so case-sensitive codes can be read back exactly.

const LETTERS: Record<string, string> = {
  a: "Alpha", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot",
  g: "Golf", h: "Hotel", i: "India", j: "Juliet", k: "Kilo", l: "Lima",
  m: "Mike", n: "November", o: "Oscar", p: "Papa", q: "Quebec", r: "Romeo",
  s: "Sierra", t: "Tango", u: "Uniform", v: "Victor", w: "Whiskey",
  x: "X-ray", y: "Yankee", z: "Zulu",
};
const DIGITS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const SYMBOLS: Record<string, string> = {
  "@": "at", ".": "dot", "-": "dash", "_": "underscore", "/": "slash",
  "&": "and", "+": "plus", "#": "hash", ":": "colon", ",": "comma",
  "'": "apostrophe", "!": "exclamation mark", "?": "question mark",
};

export function spell(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const parts: string[] = [];
    for (const ch of word) {
      const lower = ch.toLowerCase();
      if (LETTERS[lower]) parts.push(ch !== lower ? LETTERS[lower].toUpperCase() : LETTERS[lower]);
      else if (/[0-9]/.test(ch)) parts.push(DIGITS[Number(ch)]);
      else parts.push(SYMBOLS[ch] ?? ch);
    }
    lines.push(`${word.padEnd(12)}  ${parts.join("  ")}`);
  }
  return lines;
}

function main(args: string[]): void {
  const text = args.join(" ");
  if (!text.trim()) {
    for (const [ch, word] of Object.entries(LETTERS)) console.log(`${ch.toUpperCase()}  ${word}`);
    return;
  }
  for (const line of spell(text)) console.log(line);
}

if (import.meta.main) {
  main(Deno.args);
}
