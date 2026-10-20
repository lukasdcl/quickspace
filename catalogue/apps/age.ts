// summary: Exact age from a date of birth, and when the next birthday is
//
// Usage:
//   quick age 12/3/1984
//   quick age 12 march 1984
//   quick age 12/3/1984 on 1/1/2030      age on another date
//
// Dates read day first, as in the UK. Someone born on 29 February counts a
// year older on 1 March in years without one, as UK law does.

const DAY = 86400000;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function valid(p: Ymd): boolean {
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return p.m >= 1 && p.m <= 12 && date.getUTCDate() === p.d;
}

const toDay = (p: Ymd) => Date.UTC(p.y, p.m - 1, p.d) / DAY;

function month(name: string): number | null {
  const i = MONTHS.findIndex((full) => name.length >= 3 && full.startsWith(name));
  return i >= 0 ? i + 1 : name === "sept" ? 9 : null;
}

function parse(text: string): Ymd | null {
  const t = text.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (t === "today") {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  // Two-digit years mean the most recent such year, so 05 is 2005 but 84 is 1984.
  const yr = (s: string) => {
    if (s.length !== 2) return Number(s);
    const y = 2000 + Number(s);
    return y <= new Date().getFullYear() ? y : y - 100;
  };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})$/);
  if (m) return { d: +m[1], m: +m[2], y: yr(m[3]) };
  m = t.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+) (\d{2}|\d{4})$/);
  if (m && month(m[2])) return { d: +m[1], m: month(m[2])!, y: yr(m[3]) };
  m = t.match(/^([a-z]+) (?:the )?(\d{1,2})(?:st|nd|rd|th)? (\d{2}|\d{4})$/);
  if (m && month(m[1])) return { d: +m[2], m: month(m[1])!, y: yr(m[3]) };
  return null;
}

// The birthday in a given year, moving 29 February to 1 March when needed.
function birthdayIn(born: Ymd, year: number): Ymd {
  const b = { y: year, m: born.m, d: born.d };
  return valid(b) ? b : { y: year, m: 3, d: 1 };
}

export function age(born: Ymd, on: Ymd): { years: number; months: number; days: number } {
  let years = on.y - born.y;
  if (toDay(birthdayIn(born, on.y)) > toDay(on)) years--;
  const anniversary = birthdayIn(born, born.y + years);
  let months = 0;
  let mark = anniversary;
  for (;;) {
    const total = mark.y * 12 + mark.m; // one month on from mark
    const next = { y: Math.floor(total / 12), m: (total % 12) + 1, d: born.d };
    const last = new Date(Date.UTC(next.y, next.m, 0)).getUTCDate();
    next.d = Math.min(next.d, last);
    if (toDay(next) > toDay(on)) break;
    mark = next;
    months++;
  }
  return { years, months, days: toDay(on) - toDay(mark) };
}

const plural = (n: number, w: string) => `${n.toLocaleString("en-GB")} ${w}${n === 1 ? "" : "s"}`;

function fmt(p: Ymd): string {
  return new Date(toDay(p) * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(",", "");
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: age 12/3/1984, age 12 march 1984, age 12/3/1984 on 1/1/2030");
  Deno.exit(1);
}

function main(args: string[]): void {
  const text = args.join(" ").replace(/^(born|born on|of|from)\s+/i, "");
  const [bornText, onText] = text.split(/\s+(?:on|at)\s+/i);
  if (!bornText?.trim()) fail("Give a date of birth.");
  const born = parse(bornText);
  if (!born || !valid(born)) fail(`Couldn't read '${bornText.trim()}' as a date with a year.`);
  const n = new Date();
  const today = { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  const on = onText ? parse(onText) : today;
  if (!on || !valid(on)) fail(`Couldn't read '${onText!.trim()}' as a date with a year.`);
  if (toDay(on) < toDay(born)) fail("That's before they were born.");

  const a = age(born, on);
  const parts = [plural(a.years, "year")];
  if (a.months) parts.push(plural(a.months, "month"));
  if (a.days) parts.push(plural(a.days, "day"));
  const exact = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  const lead = onText ? `On ${fmt(on)}, age` : "Age";
  console.log(`${lead} ${exact}.`);
  console.log(`That's ${plural(toDay(on) - toDay(born), "day")}, born on a ${new Date(toDay(born) * DAY).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long" })}.`);

  if (!onText) {
    let next = birthdayIn(born, today.y);
    if (toDay(next) < toDay(today)) next = birthdayIn(born, today.y + 1);
    const wait = toDay(next) - toDay(today);
    const turning = next.y - born.y;
    console.log(wait === 0
      ? `Happy birthday: ${turning} today.`
      : `Turns ${turning} on ${fmt(next)}, in ${plural(wait, "day")}.`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
