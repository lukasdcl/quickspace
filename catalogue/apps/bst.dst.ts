// summary: When the clocks next go forward or back
//
// Usage:
//   quick bst              the next change in the UK
//   quick bst 2027         both changes in a year
//   quick dst us           the US dates instead
//
// The UK changes at 01:00 GMT on the last Sunday of March and October, the
// same instant as the rest of Europe. The US changes at 2am local time on
// the second Sunday of March and the first Sunday of November.

const DAY = 86400000;

interface Change {
  date: number; // whole days since 1970-01-01
  forward: boolean;
}

const makeDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const weekday = (day: number) => new Date(day * DAY).getUTCDay();

function lastSunday(y: number, m: number): number {
  const last = makeDay(y, m + 1, 0);
  return last - weekday(last);
}

function nthSunday(y: number, m: number, n: number): number {
  const first = makeDay(y, m, 1);
  return first + ((7 - weekday(first)) % 7) + 7 * (n - 1);
}

function changes(year: number, us: boolean): Change[] {
  return us
    ? [{ date: nthSunday(year, 3, 2), forward: true }, { date: nthSunday(year, 11, 1), forward: false }]
    : [{ date: lastSunday(year, 3), forward: true }, { date: lastSunday(year, 10), forward: false }];
}

function fmt(day: number): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(",", "");
}

function describe(c: Change, us: boolean): string {
  if (us) return c.forward ? `Forward an hour at 2am on ${fmt(c.date)}` : `Back an hour at 2am on ${fmt(c.date)}`;
  return c.forward
    ? `Forward an hour at 1am (to 2am) on ${fmt(c.date)}, the start of British Summer Time`
    : `Back an hour at 2am (to 1am) on ${fmt(c.date)}, the return to GMT`;
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  let us = false;
  let year: number | null = null;
  for (const w of words) {
    if (w === "us" || w === "usa" || w === "america") us = true;
    else if (["uk", "gb", "eu", "europe"].includes(w)) us = false;
    else if (/^\d{4}$/.test(w)) year = Number(w);
    else if (!["when", "do", "the", "clocks", "change", "go", "in"].includes(w)) {
      console.error(`Not sure what '${w}' means here.`);
      console.error("Try: bst, bst 2027, dst us");
      Deno.exit(1);
    }
  }
  if (year !== null) {
    for (const c of changes(year, us)) console.log(`${describe(c, us)}.`);
    return;
  }
  const now = new Date();
  const today = makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const upcoming = [...changes(now.getFullYear(), us), ...changes(now.getFullYear() + 1, us)].filter((c) => c.date > today);
  const [next, after] = upcoming;
  const days = next.date - today;
  // The change happens in the small hours of Sunday, so the day before is
  // when people think of it as happening "tonight".
  const when = days === 1 ? "tonight" : `in ${days} days`;
  console.log(`The clocks go ${next.forward ? "forward" : "back"} ${when}.`);
  console.log(`${describe(next, us)}.`);
  console.log(next.forward ? "You lose an hour in bed." : "You get an extra hour in bed.");
  console.log(`After that: ${after.forward ? "forward" : "back"} on ${fmt(after.date)}.`);
}

if (import.meta.main) {
  main(Deno.args);
}
