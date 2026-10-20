// summary: When Easter falls, this year or any year, Western and Orthodox
//
// Usage:
//   quick easter              the next Easter, with Good Friday and Easter Monday
//   quick easter 2030
//   quick easter 2026 2035    every year in a range
//   quick easter orthodox     the Orthodox date as well
//
// Easter is the first Sunday after the first full moon on or after 21 March,
// but using the church's tabulated moon rather than the real one, so the
// date comes from a fixed calculation. Orthodox churches do the same sum on
// the old Julian calendar.

const DAY = 86400000;
const makeDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;

// Anonymous Gregorian algorithm (Meeus, chapter 8).
export function western(year: number): number {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return makeDay(year, Math.floor(n / 31), (n % 31) + 1);
}

// Julian calendar computus (Meeus, chapter 8), moved onto the Gregorian
// calendar by the gap between the two, which is 13 days from 1900 to 2099.
export function orthodox(year: number): number {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const n = d + e + 114;
  const gap = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  return makeDay(year, Math.floor(n / 31), (n % 31) + 1) + gap;
}

function fmt(day: number, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", { timeZone: "UTC", ...o }).replace(",", "");
}

function short(day: number): string {
  return fmt(day, { day: "numeric", month: "short" });
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: easter, easter 2030, easter 2026 2035, easter orthodox");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().replace(/[-\u2013]/g, " ").split(/\s+/).filter((w) => w && !["to", "sunday", "in", "is", "when"].includes(w));
  let withOrthodox = false;
  const years: number[] = [];
  for (const w of words) {
    if (w === "orthodox" || w === "eastern" || w === "greek") withOrthodox = true;
    else if (/^\d{4}$/.test(w)) years.push(Number(w));
    else fail(`Not sure what '${w}' means here.`);
  }
  for (const y of years) if (y < 1583 || y > 4099) fail("Pick a year from 1583, when the Gregorian calendar began, to 4099.");

  const now = new Date();
  const today = makeDay(now.getFullYear(), now.getMonth() + 1, now.getDate());

  if (years.length === 2) {
    const [from, to] = years[0] <= years[1] ? years : [years[1], years[0]];
    if (to - from > 200) fail("Keep the range to 200 years.");
    for (let y = from; y <= to; y++) {
      const o = withOrthodox ? `   Orthodox ${short(orthodox(y)).padStart(6)}` : "";
      console.log(`${y}  ${short(western(y)).padStart(6)}${o}`);
    }
    return;
  }
  if (years.length > 2) fail("Give one year, or two for a range.");

  let year = years[0] ?? now.getFullYear();
  // With no year given, Easter Monday is the last day it is still "this" Easter.
  if (years.length === 0 && western(year) + 1 < today) year++;
  const e = western(year);
  const verb = e + 1 < today ? "was" : "is";
  console.log(`Easter Sunday ${verb} on ${fmt(e)}.`);
  console.log(`Good Friday ${short(e - 2)}, Easter Monday ${short(e + 1)}.`);
  if (e > today) console.log(`That's ${e - today} day${e - today === 1 ? "" : "s"} away.`);
  if (withOrthodox) {
    const o = orthodox(year);
    console.log(o === e ? "Orthodox Easter falls on the same day." : `Orthodox Easter ${verb} on ${fmt(o)}.`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
