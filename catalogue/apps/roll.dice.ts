// summary: Roll dice, from a single d6 to 4d6+2
//
// Usage:
//   quick roll                one six-sided die
//   quick roll 3              three of them
//   quick roll d20            one twenty-sided die
//   quick roll 2d6+3          two d6, plus three
//   quick roll 4d6 d8         several sets at once
//
// Rolls come from the system's secure random source, so every face is
// equally likely.

// Uniform integer in [0, n), by rejection so no value is favoured.
function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

interface Spec {
  count: number;
  sides: number;
  modifier: number;
  text: string;
}

export function parseSpec(word: string): Spec | null {
  const m = word.match(/^(\d*)(?:d(\d+|%))?([+-]\d+)?$/);
  if (!m || (m[1] === "" && m[2] === undefined)) return null;
  const count = m[1] === "" ? 1 : Number(m[1]);
  const sides = m[2] === undefined ? 6 : m[2] === "%" ? 100 : Number(m[2]);
  const modifier = Number(m[3] ?? 0);
  return { count, sides, modifier, text: `${count}d${sides}${m[3] ?? ""}` };
}

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function fail(message: string): never {
  console.error(message);
  console.error("Try: roll, roll 3, roll d20, roll 2d6+3");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().split(/\s+/).filter((w) => w && w !== "dice" && w !== "a" && w !== "die");
  const specs = (words.length ? words : ["1d6"]).map((w) => parseSpec(w) ?? fail(`Not sure what '${w}' means here.`));
  for (const s of specs) {
    if (s.count < 1 || s.count > 100) fail("Roll from 1 to 100 dice at a time.");
    if (s.sides < 2 || s.sides > 1000) fail("Dice need from 2 to 1000 sides.");
  }
  let grand = 0;
  for (const s of specs) {
    const rolls = Array.from({ length: s.count }, () => randomInt(s.sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0) + s.modifier;
    grand += total;
    const shown = s.sides === 6 && s.count <= 10
      ? rolls.map((r) => `${FACES[r - 1]} ${r}`).join("   ")
      : rolls.join(", ");
    const label = specs.length > 1 ? `${s.text}: ` : "";
    if (s.count === 1 && s.modifier === 0) {
      console.log(`${label}${shown}`);
    } else {
      const mod = s.modifier ? ` ${s.modifier > 0 ? "+" : "-"} ${Math.abs(s.modifier)}` : "";
      console.log(`${label}${shown}${mod}  = ${total}`);
    }
  }
  if (specs.length > 1) console.log(`Total ${grand}`);
}

if (import.meta.main) {
  main(Deno.args);
}
