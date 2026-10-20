// summary: Split a list of names into random teams
//
// Usage:
//   quick teams ann bob cat dan eve fay          two teams
//   quick teams 3 ann bob cat dan eve fay        three teams
//   quick teams of 2 ann bob cat dan eve fay     teams of two (doubles pairs)
//
// Teams differ in size by at most one. With "of", any leftover players join
// the last teams rather than forming a short one, so "of 2" with five names
// gives a pair and a three.

function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: teams ann bob cat dan, teams 3 ann bob cat dan eve fay, teams of 2 ...");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.map((a) => a.trim()).filter(Boolean);
  let count: number | null = null;
  let size: number | null = null;
  if (words[0]?.toLowerCase() === "of" && /^\d+$/.test(words[1] ?? "")) {
    size = Number(words[1]);
    words.splice(0, 2);
  } else if (/^\d+$/.test(words[0] ?? "")) {
    count = Number(words[0]);
    words.shift();
    if (words[0]?.toLowerCase() === "teams") words.shift();
  }
  const names = words.flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean);
  if (names.length < 2) fail("Give at least two names.");
  if (size !== null) {
    if (size < 1) fail("Teams need at least one player.");
    count = Math.max(1, Math.floor(names.length / size));
  }
  count ??= 2;
  if (count < 2) fail("That would make a single team.");
  if (count > names.length) fail(`There aren't enough names for ${count} teams.`);

  const teams: string[][] = Array.from({ length: count }, () => []);
  // Dealing round-robin keeps sizes within one; the larger teams come last
  // so that "of 2" reads as pairs followed by any threes.
  shuffle(names).forEach((name, i) => teams[count! - 1 - (i % count!)].push(name));
  teams.forEach((t, i) => console.log(`Team ${i + 1}: ${t.join(", ")}`));
}

if (import.meta.main) {
  main(Deno.args);
}
