// summary: The week number today or for a date, or the dates of a week
//
// Usage:
//   quick week                 this week's number and its dates
//   quick week 25/12           the week a date falls in
//   quick week 2026-12-25
//   quick week 12              the dates of week 12 this year
//   quick week 12 2027
//
// Weeks are ISO 8601 weeks, the usual business numbering in the UK and
// Europe: they start on Monday, and week 1 is the one with the year's first
// Thursday in it. So 1 January can fall in week 52 or 53 of the year before.

const DAY = 86400000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Days since 1970-01-01, so arithmetic never meets a clock change.
const makeDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const weekday = (day: number) => (new Date(day * DAY).getUTCDay() + 6) % 7; // Monday = 0
const yearOf = (day: number) => new Date(day * DAY).getUTCFullYear();

export function isoWeek(day: number): { year: number; week: number } {
  const thursday = day - weekday(day) + 3;
  const year = yearOf(thursday);
  return { year, week: Math.floor((thursday - makeDay(year, 1, 1)) / 7) + 1 };
}

function mondayOf(year: number, week: number): number {
  const jan4 = makeDay(year, 1, 4);
  return jan4 - weekday(jan4) + 7 * (week - 1);
}

function weeksIn(year: number): number {
  return isoWeek(makeDay(year, 12, 28)).week;
}

function fmt(day: number, withYear: boolean): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
  }).replace(",", "");
}

function today(): number {
  const n = new Date();
  return makeDay(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

function parseDate(text: string, now: number): number | null {
  const thisYear = yearOf(now);
  const full = (y?: string) => (y === undefined ? thisYear : y.length === 2 ? 2000 + Number(y) : Number(y));
  const valid = (y: number, m: number, d: number) => {
    const day = makeDay(y, m, d);
    return new Date(day * DAY).getUTCDate() === d && m >= 1 && m <= 12 ? day : null;
  };
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = text.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/);
  if (m) return valid(full(m[3]), +m[2], +m[1]);
  m = text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]{3})[a-z]*(?: (\d{4}))?$/);
  if (m && MONTHS.includes(m[2])) return valid(full(m[3]), MONTHS.indexOf(m[2]) + 1, +m[1]);
  m = text.match(/^([a-z]{3})[a-z]* (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/);
  if (m && MONTHS.includes(m[1])) return valid(full(m[3]), MONTHS.indexOf(m[1]) + 1, +m[2]);
  if (text === "today") return now;
  if (text === "tomorrow") return now + 1;
  return null;
}

function describeWeek(year: number, week: number, now: number, lead: string): void {
  const mon = mondayOf(year, week);
  const sameYear = yearOf(mon) === yearOf(mon + 6);
  console.log(`${lead}${lead ? "week" : "Week"} ${week} of ${year}: ${fmt(mon, !sameYear)} to ${fmt(mon + 6, true)}.`);
  const current = isoWeek(now);
  if (!lead && (current.year !== year || current.week !== week)) {
    const diff = Math.round((mon - (now - weekday(now))) / 7);
    console.log(diff > 0 ? `That's ${diff} week${diff === 1 ? "" : "s"} from now.` : `That was ${-diff} week${diff === -1 ? "" : "s"} ago.`);
  }
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: week, week 25/12, week 12, week 12 2027");
  Deno.exit(1);
}

function main(args: string[]): void {
  const now = today();
  const text = args.join(" ").toLowerCase().replace(/[,]/g, "").replace(/\b(week|wk|number|of|is|it|what|the|for|in)\b/g, "")
    .replace(/\s+/g, " ").trim();

  if (text === "") {
    const { year, week } = isoWeek(now);
    describeWeek(year, week, now, "This is ");
    console.log(`${year} has ${weeksIn(year)} weeks.`);
    return;
  }
  const m = text.match(/^(\d{1,2})(?: (\d{4}))?$/);
  if (m) {
    const year = m[2] ? Number(m[2]) : yearOf(now);
    const week = Number(m[1]);
    if (week < 1 || week > weeksIn(year)) fail(`${year} has weeks 1 to ${weeksIn(year)}.`);
    describeWeek(year, week, now, "");
    return;
  }
  if (text === "next" || text === "last") {
    const { year, week } = isoWeek(now + (text === "next" ? 7 : -7));
    describeWeek(year, week, now, text === "next" ? "Next week is " : "Last week was ");
    return;
  }
  const day = parseDate(text, now);
  if (day === null) fail(`Couldn't read '${args.join(" ")}' as a date or a week number.`);
  const { year, week } = isoWeek(day);
  console.log(`${fmt(day, true)} is in week ${week}${year !== yearOf(day) ? ` of ${year}` : ""}.`);
}

if (import.meta.main) {
  main(Deno.args);
}
