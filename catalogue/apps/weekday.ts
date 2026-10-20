// summary: The day of the week for any date, past or future
//
// Usage:
//   quick weekday 4 july 1976     a Sunday
//   quick weekday 2031-03-14
//   quick weekday 25 dec          the next few years' Christmases
//
// Dates read day first, as in the UK: 3/4 is the 3rd of April. Dates before
// 1752 use the Gregorian calendar throughout, which Britain only adopted in
// that year, so older weekdays may not match period documents.

const DAY = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function makeDay(y: number, m: number, d: number): number | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(2000, m - 1, d));
  date.setUTCFullYear(y);
  return date.getUTCDate() === d ? date.getTime() / DAY : null;
}

function month(name: string): number | null {
  const i = MONTHS.findIndex((full) => name.length >= 3 && full.startsWith(name));
  return i >= 0 ? i + 1 : name === "sept" ? 9 : null;
}

// Returns day, month and year (null when the year was left out).
export function parse(text: string): { d: number; m: number; y: number | null } | null {
  const t = text.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const yr = (s?: string) => (s === undefined ? null : s.length === 2 ? 2000 + Number(s) : Number(s));
  let m = t.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{3,4}))?$/);
  if (m) return { d: +m[1], m: +m[2], y: yr(m[3]) };
  m = t.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?: (\d{1,4}))?$/);
  if (m && month(m[2])) return { d: +m[1], m: month(m[2])!, y: m[3] ? Number(m[3]) : null };
  m = t.match(/^([a-z]+) (?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: (\d{1,4}))?$/);
  if (m && month(m[1])) return { d: +m[2], m: month(m[1])!, y: m[3] ? Number(m[3]) : null };
  return null;
}

function fmt(day: number, o: Intl.DateTimeFormatOptions): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", { timeZone: "UTC", ...o }).replace(",", "");
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: weekday 4 july 1976, weekday 2031-03-14, weekday 25 dec");
  Deno.exit(1);
}

function main(args: string[]): void {
  const text = args.join(" ").replace(/^(was|is|will|on|what day)\s+/i, "");
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY;
  if (!text.trim()) {
    console.log(`Today is ${fmt(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`);
    return;
  }
  const p = parse(text);
  if (!p) fail(`Couldn't read '${text.trim()}' as a date.`);

  if (p.y === null) {
    if (makeDay(2000, p.m, p.d) === null) fail("That date doesn't exist.");
    const label = fmt(makeDay(2000, p.m, p.d)!, { day: "numeric", month: "long" });
    console.log(`${label} falls on:`);
    let shown = 0;
    for (let y = now.getFullYear(); shown < 6; y++) {
      const day = makeDay(y, p.m, p.d);
      if (day === null || day < today) continue;
      console.log(`  ${fmt(day, { weekday: "long" }).padEnd(9)}  in ${y}`);
      shown++;
    }
    return;
  }
  const day = makeDay(p.y, p.m, p.d);
  if (day === null) fail("That date doesn't exist.");
  const verb = day < today ? "was" : day > today ? "will be" : "is";
  const weekday = fmt(day, { weekday: "long" });
  console.log(`${fmt(day, { day: "numeric", month: "long", year: "numeric" })} ${verb} a ${weekday}.`);
}

if (import.meta.main) {
  main(Deno.args);
}
