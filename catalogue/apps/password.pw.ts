// summary: A strong random password that is easy to read and type
//
// Usage:
//   quick password                 kibvan-Tuhzep-vyc4ak  (over 70 bits)
//   quick password 24              24 random letters, digits and symbols
//   quick password 24 no symbols
//   quick password pin             a 6-digit PIN
//   quick password pin 4
//   quick password x5              five to choose from
//
// The default style alternates consonants and vowels so it can be read out
// loud, and leaves out letters and digits that are easy to confuse (l, o,
// 0, 1). Prints only the passwords, so `quick pw | pbcopy` works.

const CONSONANTS = "bcdfghjkmnpqrstvwxz";
const VOWELS = "aeiuy";
const DIGITS = "23456789";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ALL_DIGITS = "0123456789";
const SYMBOLS = "!#$%&*+-=?@^_~";

// Uniform integer in [0, n), by rejection so no value is favoured.
function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

const pick = (chars: string) => chars[randomInt(chars.length)];

function readable(): string {
  const chars: string[] = [];
  for (let group = 0; group < 3; group++) {
    for (const set of [CONSONANTS, VOWELS, CONSONANTS, CONSONANTS, VOWELS, CONSONANTS]) {
      chars.push(pick(set));
    }
  }
  const digitAt = randomInt(chars.length);
  chars[digitAt] = pick(DIGITS);
  let upperAt;
  do upperAt = randomInt(chars.length); while (upperAt === digitAt);
  chars[upperAt] = chars[upperAt].toUpperCase();
  return [0, 6, 12].map((i) => chars.slice(i, i + 6).join("")).join("-");
}

// Draws until every class appears, which keeps the result uniform over the
// passwords that satisfy the usual site rules.
function random(length: number, symbols: boolean): string {
  const classes = [LOWER, UPPER, ALL_DIGITS, ...(symbols ? [SYMBOLS] : [])];
  const all = classes.join("");
  for (;;) {
    const pw = Array.from({ length }, () => pick(all)).join("");
    if (length < classes.length || classes.every((c) => [...pw].some((ch) => c.includes(ch)))) return pw;
  }
}

function pin(length: number): string {
  return Array.from({ length }, () => pick(ALL_DIGITS)).join("");
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: password, password 24, password 20 no symbols, password pin, password x5");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().replace(/\bno\s+symbols?\b/, "nosymbols")
    .split(/\s+/).filter(Boolean);
  let kind: "readable" | "random" | "pin" = "readable";
  let length: number | null = null;
  let count = 1;
  let symbols = true;
  for (const w of words) {
    const times = w.match(/^x(\d+)$/) ?? w.match(/^(\d+)x$/);
    if (times) count = Number(times[1]);
    else if (/^\d+$/.test(w)) length = Number(w);
    else if (w === "pin") kind = "pin";
    else if (w === "nosymbols" || w === "simple" || w === "alphanumeric") symbols = false;
    else if (!["chars", "characters", "long", "digits", "digit", "a", "with"].includes(w)) {
      fail(`Not sure what '${w}' means here.`);
    }
  }
  if (count < 1 || count > 50) fail("Pick from 1 to 50 passwords.");
  if (kind !== "pin" && (length !== null || !symbols)) kind = "random";
  if (kind === "pin") length ??= 6;
  if (kind === "random") length ??= 20;
  if (length !== null && (length < 4 || length > 256)) fail("Pick a length from 4 to 256.");

  for (let i = 0; i < count; i++) {
    if (kind === "readable") console.log(readable());
    else if (kind === "pin") console.log(pin(length!));
    else console.log(random(length!, symbols));
  }
}

if (import.meta.main) {
  main(Deno.args);
}
