// summary: The next UK bank holidays, for England and Wales, Scotland or Northern Ireland
//
// Usage:
//   quick bankhol                the next five in England and Wales
//   quick bankhol 2027           all of them in a year
//   quick bankhol scotland       or ni, northern ireland
//   quick bankhol 10             the next ten
//
// The regular holidays follow fixed rules, with a holiday that lands on a
// weekend moved to the next free weekday. One-off holidays and moved dates,
// such as for coronations and jubilees, are set by proclamation and are in
// the table below; any announced after this file was last updated will be
// missing.

const DAY = 86400000;
type Region = "ew" | "sc" | "ni";
const REGION_NAMES: Record<Region, string> = { ew: "England and Wales", sc: "Scotland", ni: "Northern Ireland" };

const makeDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const weekday = (day: number) => new Date(day * DAY).getUTCDay();

// Changes to the regular pattern across the whole UK. A null date removes
// the regular holiday of that name in that year.
const ONE_OFFS: Array<[string, string, string | null]> = [
  ["1995-05-08", "Early May bank holiday (VE Day)", "Early May bank holiday"],
  ["1999-12-31", "Millennium", null],
  ["2002-06-03", "Golden Jubilee", null],
  ["2002-06-04", "Spring bank holiday", "Spring bank holiday"],
  ["2011-04-29", "Royal wedding", null],
  ["2012-06-04", "Spring bank holiday", "Spring bank holiday"],
  ["2012-06-05", "Diamond Jubilee", null],
  ["2020-05-08", "Early May bank holiday (VE Day)", "Early May bank holiday"],
  ["2022-06-02", "Spring bank holiday", "Spring bank holiday"],
  ["2022-06-03", "Platinum Jubilee", null],
  ["2022-09-19", "State funeral of Queen Elizabeth II", null],
  ["2023-05-08", "Coronation of King Charles III", null],
];

function easter(year: number): number {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return makeDay(year, Math.floor(n / 31), (n % 31) + 1);
}

function firstMonday(y: number, m: number): number {
  const first = makeDay(y, m, 1);
  return first + ((8 - weekday(first)) % 7);
}

function lastMonday(y: number, m: number): number {
  const last = makeDay(y, m + 1, 0);
  return last - ((weekday(last) + 6) % 7);
}

export function holidays(year: number, region: Region): Array<{ day: number; name: string }> {
  const out: Array<{ day: number; name: string }> = [];
  const add = (day: number, name: string) => out.push({ day, name });
  const fixed: Array<[number, number, string]> = [[1, 1, "New Year's Day"]];
  if (region === "sc") fixed.push([1, 2, "2nd January"]);
  if (region === "ni") fixed.push([3, 17, "St Patrick's Day"]);
  if (region === "ni") fixed.push([7, 12, "Battle of the Boyne"]);
  if (region === "sc") fixed.push([11, 30, "St Andrew's Day"]);
  fixed.push([12, 25, "Christmas Day"], [12, 26, "Boxing Day"]);

  add(easter(year) - 2, "Good Friday");
  if (region !== "sc") add(easter(year) + 1, "Easter Monday");
  add(firstMonday(year, 5), "Early May bank holiday");
  add(lastMonday(year, 5), "Spring bank holiday");
  add(region === "sc" ? firstMonday(year, 8) : lastMonday(year, 8), "Summer bank holiday");

  // Fixed-date holidays that land on a weekday keep their date. Those on a
  // weekend move to the next weekday that isn't already a holiday, so when
  // Christmas is on a Sunday, Boxing Day keeps Monday and Christmas moves to
  // Tuesday.
  const isWeekend = (day: number) => weekday(day) === 0 || weekday(day) === 6;
  const taken = new Set<number>();
  for (const [m, d, name] of fixed) {
    const day = makeDay(year, m, d);
    if (!isWeekend(day)) {
      add(day, name);
      taken.add(day);
    }
  }
  for (const [m, d, name] of fixed) {
    let day = makeDay(year, m, d);
    if (!isWeekend(day)) continue;
    while (isWeekend(day) || taken.has(day)) day++;
    taken.add(day);
    add(day, `${name} (substitute day)`);
  }

  for (const [date, name, replaces] of ONE_OFFS) {
    if (Number(date.slice(0, 4)) !== year) continue;
    if (replaces) {
      const i = out.findIndex((h) => h.name === replaces);
      if (i >= 0) out.splice(i, 1);
    }
    const [y, m, d] = date.split("-").map(Number);
    out.push({ day: makeDay(y, m, d), name });
  }
  return out.sort((a, b) => a.day - b.day);
}

function fmt(day: number): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).replace(",", "");
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: bankhol, bankhol 2027, bankhol scotland, bankhol ni");
  Deno.exit(1);
}

function main(args: string[]): void {
  const text = args.join(" ").toLowerCase().replace(/northern ireland/g, "ni").replace(/england and wales|england|wales/g, "ew");
  let region: Region = "ew";
  let year: number | null = null;
  let count = 5;
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (w === "ni" || w === "ulster") region = "ni";
    else if (w === "scotland" || w === "scottish" || w === "sc") region = "sc";
    else if (w === "ew") region = "ew";
    else if (/^\d{4}$/.test(w)) year = Number(w);
    else if (/^\d{1,2}$/.test(w)) count = Number(w);
    else if (!["next", "bank", "holiday", "holidays", "in", "for", "the"].includes(w)) fail(`Not sure what '${w}' means here.`);
  }
  if (year !== null && (year < 1990 || year > 2200)) fail("Pick a year from 1990 to 2200.");
  if (count < 1 || count > 50) fail("Ask for from 1 to 50.");

  const now = new Date();
  const today = makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let list: Array<{ day: number; name: string }>;
  if (year !== null) {
    list = holidays(year, region);
    console.log(`Bank holidays in ${REGION_NAMES[region]}, ${year}:`);
  } else {
    list = [];
    for (let y = now.getFullYear(); list.length < count; y++) {
      list.push(...holidays(y, region).filter((h) => h.day >= today));
    }
    list = list.slice(0, count);
    console.log(`Next bank holidays in ${REGION_NAMES[region]}:`);
  }
  for (const h of list) {
    const diff = h.day - today;
    const when = diff === 0 ? "today" : diff === 1 ? "tomorrow" : diff > 0 ? `in ${diff} days` : "";
    console.log(`  ${fmt(h.day).padEnd(16)}  ${h.name}${when && year === null ? `, ${when}` : ""}`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
