// summary: Days until a date, or the date a number of days from now
//
// Usage:
//   quick days                        today's date and day of the year
//   quick days 25 dec                 how long until a date
//   quick days until christmas
//   quick days since 1 jan
//   quick date in 30                  the date in 30 days
//   quick date in 6 weeks
//   quick date 90 days ago
//   quick date 2 weeks after 25 dec
//   quick days from 1 jan to 25 dec   the days between two dates
//
// Dates read day first, as in the UK: 3/4 is the 3rd of April. A date with
// no year means the next one to come, or the last one gone for "since".

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY = 86400000;

// A calendar date, held as whole days since 1970-01-01 so that arithmetic
// never runs into clock changes.
type Day = number;

function makeDay(year: number, month: number, date: number): Day | null {
  const ms = Date.UTC(year, month - 1, date);
  const d = new Date(ms);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== date) return null;
  return ms / DAY;
}

function parts(day: Day) {
  const d = new Date(day * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate(), weekday: d.getUTCDay() };
}

function today(): Day {
  const now = new Date();
  return makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate())!;
}

function addMonths(day: Day, months: number): Day {
  const { year, month, date } = parts(day);
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12), m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return makeDay(y, m, Math.min(date, last))!;
}

function format(day: Day, withYear = true): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  }).replace(",", "");
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function span(days: number): string {
  const n = Math.abs(days);
  if (n < 14) return plural(n, "day");
  const weeks = Math.floor(n / 7), rest = n % 7;
  return `${plural(n, "day")} (${plural(weeks, "week")}${rest ? ` and ${plural(rest, "day")}` : ""})`;
}

// Easter Sunday by the anonymous Gregorian algorithm.
function easter(year: number): Day {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), date = ((h + l - 7 * m + 114) % 31) + 1;
  return makeDay(year, month, date)!;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): Day {
  const first = makeDay(year, month, 1)!;
  return first + ((weekday - parts(first).weekday + 7) % 7) + 7 * (n - 1);
}

// Named days, as a function from a year to that year's date.
const OCCASIONS: Array<[RegExp, string, (y: number) => Day]> = [
  [/^christmas eve$/, "Christmas Eve", (y) => makeDay(y, 12, 24)!],
  [/^(christmas|xmas)( day)?$/, "Christmas Day", (y) => makeDay(y, 12, 25)!],
  [/^boxing day$/, "Boxing Day", (y) => makeDay(y, 12, 26)!],
  [/^(new years? eve|nye)$/, "New Year's Eve", (y) => makeDay(y, 12, 31)!],
  [/^new years?( day)?$/, "New Year's Day", (y) => makeDay(y, 1, 1)!],
  [/^valentines?( day)?$/, "Valentine's Day", (y) => makeDay(y, 2, 14)!],
  [/^(st )?patricks? day$/, "St Patrick's Day", (y) => makeDay(y, 3, 17)!],
  [/^halloween$/, "Halloween", (y) => makeDay(y, 10, 31)!],
  [/^(bonfire|guy fawkes)( night)?$/, "Bonfire Night", (y) => makeDay(y, 11, 5)!],
  [/^easter( sunday)?$/, "Easter Sunday", easter],
  [/^good friday$/, "Good Friday", (y) => easter(y) - 2],
  [/^easter monday$/, "Easter Monday", (y) => easter(y) + 1],
  [/^(mothers day|mothering sunday)$/, "Mother's Day", (y) => easter(y) - 21],
  [/^fathers day$/, "Father's Day", (y) => nthWeekday(y, 6, 0, 3)],
];

interface Target {
  day: Day;
  name?: string;
}

// Parses a single date. With no year given, `past` picks the most recent one
// rather than the next.
function parseDate(text: string, now: Day, past: boolean): Target | null {
  const pick = (make: (y: number) => Day | null, year?: number): Day | null => {
    if (year !== undefined) return make(year);
    // Search a few years either way so that 29 February finds a leap year.
    const step = past ? -1 : 1;
    for (let y = parts(now).year, n = 0; n < 9; y += step, n++) {
      const day = make(y);
      if (day !== null && (past ? day <= now : day >= now)) return day;
    }
    return null;
  };
  const fullYear = (y: string | undefined) =>
    y === undefined ? undefined : y.length === 2 ? 2000 + Number(y) : Number(y);
  const month = (name: string) => {
    const i = MONTH_NAMES.findIndex((full) => name.length >= 3 && full.startsWith(name));
    return i >= 0 ? i + 1 : name === "sept" ? 9 : null;
  };

  if (text === "today" || text === "now") return { day: now };
  if (text === "tomorrow") return { day: now + 1 };
  if (text === "yesterday") return { day: now - 1 };

  for (const [pattern, name, make] of OCCASIONS) {
    const m = text.match(new RegExp(pattern.source.slice(0, -1) + "(?: (\\d{4}))?$"));
    if (m) {
      const day = pick(make, fullYear(m.at(-1)));
      return day === null ? null : { day, name };
    }
  }

  const weekday = text.match(/^(?:next |this |last )?([a-z]+)$/);
  if (weekday) {
    const w = WEEKDAYS.findIndex((d) => d === weekday[1] || d.slice(0, 3) === weekday[1]);
    if (w >= 0) {
      const back = text.startsWith("last ") || past;
      const diff = back
        ? -(((parts(now).weekday - w + 7) % 7) || 7)
        : ((w - parts(now).weekday + 7) % 7) || 7;
      return { day: now + diff };
    }
  }

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return wrap(makeDay(+m[1], +m[2], +m[3]));

  m = text.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/);
  if (m) return wrap(pick((y) => makeDay(y, +m![2], +m![1]), fullYear(m[3])));

  m = text.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?: (\d{4}))?$/);
  if (m && month(m[2])) return wrap(pick((y) => makeDay(y, month(m![2])!, +m![1]), fullYear(m[3])));

  m = text.match(/^([a-z]+) (?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}))?$/);
  if (m && month(m[1])) return wrap(pick((y) => makeDay(y, month(m![1])!, +m![2]), fullYear(m[3])));

  m = text.match(/^([a-z]+)(?: (\d{4}))?$/);
  if (m && month(m[1])) return wrap(pick((y) => makeDay(y, month(m![1])!, 1), fullYear(m[2])));

  return null;
}

function wrap(day: Day | null): Target | null {
  return day === null ? null : { day };
}

const UNITS: Record<string, [number, "days" | "months"]> = {
  d: [1, "days"], day: [1, "days"],
  w: [7, "days"], wk: [7, "days"], week: [7, "days"],
  fortnight: [14, "days"],
  m: [1, "months"], mo: [1, "months"], month: [1, "months"],
  y: [12, "months"], yr: [12, "months"], year: [12, "months"],
};

// Parses an amount of time such as "30", "6 weeks" or "a fortnight".
function parseOffset(text: string): { amount: number; unit: "days" | "months" } | null {
  const m = text.match(/^(a|an|\d+)\s*([a-z]*?)s?$/);
  if (!m) return null;
  const n = m[1] === "a" || m[1] === "an" ? 1 : Number(m[1]);
  if (m[1].startsWith("a") && m[2] === "") return null;
  const unit = UNITS[m[2] === "" ? "d" : m[2]];
  return unit ? { amount: n * unit[0], unit: unit[1] } : null;
}

function shift(day: Day, offset: { amount: number; unit: "days" | "months" }, sign: number): Day {
  return offset.unit === "days" ? day + sign * offset.amount : addMonths(day, sign * offset.amount);
}

function describe(target: Target, now: Day): string {
  const diff = target.day - now;
  const date = format(target.day);
  const subject = target.name ? `${target.name} is on ${date},` : `${date} is`;
  if (diff === 0) return target.name ? `${target.name} is today.` : `That's today, ${date}.`;
  if (diff > 0) return `${subject} in ${span(diff)}.`;
  return target.name
    ? `${target.name} was on ${date}, ${span(diff)} ago.`
    : `${date} was ${span(diff)} ago.`;
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: days 25 dec, days until christmas, date in 30, date 6 weeks ago");
  Deno.exit(1);
}

function run(input: string, now: Day): string {
  let text = input.toLowerCase().replace(/[,?!'\u2019]/g, "").replace(/\s+/g, " ").trim();

  if (text === "") {
    const { year } = parts(now);
    const first = makeDay(year, 1, 1)!, next = makeDay(year + 1, 1, 1)!;
    return `Today is ${format(now)}, day ${now - first + 1} of ${next - first}. ` +
      `${plural(next - now - 1, "day")} left this year.`;
  }

  text = text.replace(/^(how many days |how long |what date is it |what is the date |what date )/, "");
  let past = false;
  const lead = text.match(/^(until|till|til|to|since|is|on|for|it) (.*)$/);
  if (lead) {
    past = lead[1] === "since";
    text = lead[2];
  }

  let m = text.match(/^(?:between|from) (.+?) (?:and|to|until|till) (.+)$/);
  if (m) {
    const a = parseDate(m[1], now, true), b = parseDate(m[2], now, false);
    if (!a) fail(`Couldn't read the date '${m[1]}'.`);
    if (!b) fail(`Couldn't read the date '${m[2]}'.`);
    const start = Math.min(a.day, b.day), end = Math.max(a.day, b.day);
    const sameYear = parts(start).year === parts(end).year;
    return `From ${format(start, !sameYear)} to ${format(end)} is ${span(end - start)}.`;
  }

  m = text.match(/^(.+?) (after|before|from) (.+)$/);
  if (m) {
    const offset = parseOffset(m[1]);
    const base = parseDate(m[3], now, false);
    if (offset && base) {
      const day = shift(base.day, offset, m[2] === "before" ? -1 : 1);
      return `${format(day)}, ${diffPhrase(day - now)}.`;
    }
  }

  m = text.match(/^(?:in |\+)?(.+?)( ago| from now| from today| time)?$/);
  const negative = text.startsWith("-") || m?.[2] === " ago";
  const offset = m ? parseOffset(m[1].replace(/^-/, "")) : null;
  if (offset && (m![2] !== undefined || text.startsWith("in ") || /^[+-]?\d/.test(text))) {
    const day = shift(now, offset, negative ? -1 : 1);
    return negative
      ? `${cap(amountPhrase(offset))} ago it was ${format(day)}.`
      : `In ${amountPhrase(offset)} it will be ${format(day)}.`;
  }

  const target = parseDate(text, now, past);
  if (!target) fail(`Couldn't read '${input.trim()}' as a date.`);
  return describe(target, now);
}

function amountPhrase(o: { amount: number; unit: "days" | "months" }): string {
  if (o.unit === "months") return o.amount % 12 === 0 ? plural(o.amount / 12, "year") : plural(o.amount, "month");
  if (o.amount % 7 === 0 && o.amount >= 7) return plural(o.amount / 7, "week");
  return plural(o.amount, "day");
}

function diffPhrase(diff: number): string {
  if (diff === 0) return "which is today";
  return diff > 0 ? `in ${span(diff)}` : `${span(diff)} ago`;
}

function cap(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

if (import.meta.main) {
  console.log(run(Deno.args.join(" "), today()));
}
