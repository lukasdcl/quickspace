// summary: Chinese New Year's date and the year's animal and element
//
// Usage:
//   quick chinese             the next New Year
//   quick chinese 2030
//   quick chinese 1984        also works for a birth year's animal
//
// The Chinese calendar is lunisolar. New Year falls on the day of the
// second new moon after the winter solstice, counted in China's time zone,
// unless a leap month falls in between, when it is the third. Whether there
// is a leap month depends on where the new moons fall against the Sun's
// twelve principal terms (zhongqi), so this works out both from the Sun's
// and Moon's positions rather than from a table. A year whose date falls
// before New Year belongs to the previous animal.

const rad = (d: number) => (d * Math.PI) / 180;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const norm = (d: number) => ((d % 360) + 360) % 360;

// Moon terms from Meeus table 47.A and 47.B: D, M, M', F, longitude (1e-6
// degrees), distance (metres). Only the larger ones, which place new moons
// to within a couple of minutes.
const LR: number[][] = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
const B: number[][] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
];

const centuries = (ms: number) => (ms / 86400000 + 2440587.5 - 2451545) / 36525;

// Geocentric ecliptic longitude, latitude (degrees) and distance (km).
function moon(T: number): [number, number, number] {
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  let l = 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2), r = 0;
  for (const [d, m, mp, f, cl, cr] of LR) {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    const arg = d * D + m * M + mp * Mp + f * F;
    l += cl * e * sin(arg);
    r += cr * e * cos(arg);
  }
  let b = -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) +
    127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  for (const [d, m, mp, f, cb] of B) {
    const e = Math.abs(m) === 1 ? E : 1;
    b += cb * e * sin(d * D + m * M + mp * Mp + f * F);
  }
  return [norm(Lp + l / 1e6), b / 1e6, 385000.56 + r / 1000];
}

// Apparent geocentric ecliptic longitude (degrees) and distance (AU).
function sun(T: number): [number, number, number] {
  const L0 = 280.46646 + 36000.76983 * T;
  const M = 357.52911 + 35999.05029 * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const v = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(v));
  const omega = 125.04 - 1934.136 * T;
  return [norm(L0 + C - 0.00569 - 0.00478 * sin(omega)), 0, R];
}

const DAY = 86400000;
const CHINA = 8 * 3600000; // UTC+8, the calendar's reference time zone

// Moon's longitude minus the Sun's, in (-180, 180].
function elongation(ms: number): number {
  const T = centuries(ms);
  return ((moon(T)[0] - sun(T)[0]) % 360 + 540) % 360 - 180;
}

// Bisects f, which must change sign once between lo and hi.
function solve(f: (ms: number) => number, lo: number, hi: number): number {
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if ((f(lo) < 0) === (f(mid) < 0)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The new moon at or before ms.
function newMoonBefore(ms: number): number {
  let t = ms;
  while (!(elongation(t - 6 * 3600000) < 0 && elongation(t) >= 0)) t -= 6 * 3600000;
  return solve(elongation, t - 6 * 3600000, t);
}

function newMoonAfter(ms: number): number {
  let t = ms + 3600000;
  while (!(elongation(t) < 0 && elongation(t + 6 * 3600000) >= 0)) t += 6 * 3600000;
  return solve(elongation, t, t + 6 * 3600000);
}

// The moment the Sun reaches ecliptic longitude `target`, within 20 days of
// a guess.
function solarTerm(guess: number, target: number): number {
  const f = (ms: number) => ((sun(centuries(ms))[0] - target) % 360 + 540) % 360 - 180;
  return solve(f, guess - 20 * DAY, guess + 20 * DAY);
}

// Calendar day number in China for an instant.
const chinaDay = (ms: number) => Math.floor((ms + CHINA) / DAY);

export function newYear(year: number): number {
  const s1 = solarTerm(Date.UTC(year - 1, 11, 21), 270), s2 = solarTerm(Date.UTC(year, 11, 21), 270);
  // Month 11 is the one whose first day is on or before the solstice's day.
  let m11 = newMoonBefore(s1);
  if (chinaDay(newMoonAfter(m11)) <= chinaDay(s1)) m11 = newMoonAfter(m11);
  const starts = [m11];
  while (chinaDay(starts.at(-1)!) <= chinaDay(s2) - 25) starts.push(newMoonAfter(starts.at(-1)!));
  const days = starts.map(chinaDay);
  // Twelve months to the next month 11 means no leap month.
  const next11 = days.findIndex((d, i) => i > 0 && d <= chinaDay(s2) && (days[i + 1] ?? Infinity) > chinaDay(s2));
  let leap = -1;
  if (next11 === 13) {
    // The first month with no principal term in it is the leap month. The
    // terms run from one winter solstice to the next.
    const terms = [...Array(13).keys()].map((k) => chinaDay(solarTerm(s1 + k * 30.44 * DAY, (270 + 30 * k) % 360)));
    for (let i = 0; i < 13 && leap < 0; i++) {
      if (!terms.some((d) => d >= days[i] && d < days[i + 1])) leap = i;
    }
  }
  return days[leap === 1 || leap === 2 ? 3 : 2];
}

const ANIMALS = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];
const ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"];

function sign(year: number): string {
  const n = ((year - 4) % 60 + 60) % 60;
  return `${ELEMENTS[Math.floor((n % 10) / 2)]} ${ANIMALS[n % 12]}`;
}

function fmt(day: number): string {
  return new Date(day * DAY).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(",", "");
}

function main(args: string[]): void {
  const text = args.join(" ").trim();
  const now = new Date();
  const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);
  if (text && !/^\d{4}$/.test(text)) {
    console.error(`'${text}' isn't a year.`);
    console.error("Try: chinese, chinese 2030, chinese 1984");
    Deno.exit(1);
  }
  let year = text ? Number(text) : now.getFullYear();
  if (year < 1900 || year > 2100) {
    console.error("Pick a year from 1900 to 2100.");
    Deno.exit(1);
  }
  if (!text && newYear(year) < today) year++;
  const day = newYear(year);
  const diff = day - today;
  const verb = diff < 0 ? "was" : "is";
  console.log(`Chinese New Year ${year} ${verb} on ${fmt(day)}${diff === 0 ? ", today" : ""}.`);
  console.log(`It starts the Year of the ${sign(year)}, which runs until ${fmt(newYear(year + 1) - 1)}.`);
  if (diff > 0 && diff < 400) console.log(`That's ${diff} day${diff === 1 ? "" : "s"} away.`);
  if (text) console.log(`Born between 1 January and ${fmt(day - 1)}: Year of the ${sign(year - 1)}.`);
}

if (import.meta.main) {
  main(Deno.args);
}
