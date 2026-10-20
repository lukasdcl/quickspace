// summary: Whether a year is a leap year, and when the next ones are
//
// Usage:
//   quick leap              this year, and the next few leap years
//   quick leap 2100         is 2100 a leap year
//   quick leap 1900 2000
//
// A year divisible by 4 is a leap year, except that century years are
// only leap years when divisible by 400. That is why 2000 was one and
// 2100 won't be.

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function why(y: number): string {
  if (y % 400 === 0) return "divisible by 400";
  if (y % 100 === 0) return "a century year not divisible by 400";
  if (y % 4 === 0) return "divisible by 4";
  return "not divisible by 4";
}

function main(args: string[]): void {
  const words = args.join(" ").split(/[\s,]+/).filter((w) => w && !["is", "a", "year"].includes(w.toLowerCase()));
  const now = new Date().getFullYear();
  if (words.length === 0) {
    console.log(`${now} ${isLeap(now) ? "is" : "is not"} a leap year.`);
    const next: number[] = [];
    for (let y = now + 1; next.length < 5; y++) if (isLeap(y)) next.push(y);
    console.log(`Next: ${next.join(", ")}`);
    return;
  }
  for (const w of words) {
    if (!/^\d{1,5}$/.test(w)) {
      console.error(`'${w}' isn't a year.`);
      console.error("Try: leap, leap 2100");
      Deno.exit(1);
    }
    const y = Number(w);
    const tense = y < now ? "was" : y > now ? "will be" : "is";
    const neg = y < now ? "was not" : y > now ? "won't be" : "is not";
    console.log(`${y} ${isLeap(y) ? tense : neg} a leap year (${why(y)}).`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
