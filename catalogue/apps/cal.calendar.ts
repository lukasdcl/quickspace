// summary: A month calendar with today marked, weeks starting on Monday
//
// Usage:
//   quick cal                 this month
//   quick cal 3               this month and the next two
//   quick cal dec             a month by name, the next one to come
//   quick cal feb 2028
//   quick cal 2027            the whole year
//
// Week numbers down the left are ISO weeks, as in quick week.

const DAY = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WIDTH = 25;

const makeDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const monday0 = (day: number) => (new Date(day * DAY).getUTCDay() + 6) % 7;

function isoWeek(day: number): number {
  const thursday = day - monday0(day) + 3;
  const year = new Date(thursday * DAY).getUTCFullYear();
  return Math.floor((thursday - makeDay(year, 1, 1)) / 7) + 1;
}

// One month as lines of equal width, so months can be laid side by side.
export function month(year: number, m: number, today: number, live: boolean): string[] {
  const title = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${year}`;
  const lines = [title.padStart(Math.floor((WIDTH + title.length) / 2)).padEnd(WIDTH), "    Mo Tu We Th Fr Sa Su "];
  const first = makeDay(year, m, 1), last = makeDay(year, m + 1, 0);
  for (let start = first - monday0(first); start <= last; start += 7) {
    let line = String(isoWeek(start)).padStart(2) + "  ";
    for (let day = start; day < start + 7; day++) {
      const n = new Date(day * DAY).getUTCDate();
      const cell = day < first || day > last ? "  " : String(n).padStart(2);
      if (day === today && live) line += `\x1b[7m${cell}\x1b[0m `;
      else if (day === today) line += `${cell}*`;
      else line += `${cell} `;
    }
    lines.push(line);
  }
  return lines;
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: cal, cal 3, cal dec, cal feb 2028, cal 2027");
  Deno.exit(1);
}

function main(args: string[]): void {
  const now = new Date();
  const today = makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const live = Deno.stdout.isTerminal();
  const words = args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  let year = now.getFullYear(), start = now.getMonth() + 1, count = 1;
  let named: number | null = null, givenYear: number | null = null;
  for (const w of words) {
    const i = MONTHS.findIndex((full) => w.length >= 3 && full.startsWith(w));
    if (i >= 0) named = i + 1;
    else if (/^\d{4}$/.test(w)) givenYear = Number(w);
    else if (/^\d{1,2}$/.test(w)) count = Number(w);
    else if (w !== "next" && w !== "months") fail(`Not sure what '${w}' means here.`);
  }
  if (count < 1 || count > 24) fail("Show from 1 to 24 months.");
  if (givenYear !== null && named === null) {
    year = givenYear;
    start = 1;
    count = 12;
  } else if (named !== null) {
    start = named;
    year = givenYear ?? (named < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear());
  }

  const months: string[][] = [];
  for (let i = 0; i < count; i++) {
    const total = year * 12 + start - 1 + i;
    months.push(month(Math.floor(total / 12), (total % 12) + 1, today, live));
  }
  let columns = 3;
  try {
    columns = Math.max(1, Math.min(3, Math.floor((Deno.consoleSize().columns + 2) / (WIDTH + 2))));
  } catch {
    // Not a terminal: keep three across.
  }
  for (let i = 0; i < months.length; i += columns) {
    const row = months.slice(i, i + columns);
    if (i) console.log();
    const height = Math.max(...row.map((mo) => mo.length));
    for (let line = 0; line < height; line++) {
      console.log(row.map((mo) => mo[line] ?? " ".repeat(WIDTH)).join("  ").trimEnd());
    }
  }
}

if (import.meta.main) {
  main(Deno.args);
}
