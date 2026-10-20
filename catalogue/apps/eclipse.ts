// summary: The next solar and lunar eclipses, and how much of each the UK will see
//
// Usage:
//   quick eclipse             the next six
//   quick eclipse 12          more of them
//   quick eclipse solar       only eclipses of the Sun
//   quick eclipse lunar       only eclipses of the Moon
//   quick eclipse uk          only those visible from the UK
//
// Eclipses are found by working out the Sun's and Moon's positions at each
// new and full moon: Meeus, Astronomical Algorithms, chapter 25 for the Sun
// and the larger terms of chapter 47 for the Moon. Times are good to a few
// minutes and the share of the Sun covered to a few percent. The UK view is
// worked out for London; elsewhere in the UK it differs by a few percent.
//
// Never look at the Sun during a partial eclipse without proper eclipse
// glasses.

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));
const norm = (d: number) => ((d % 360) + 360) % 360;

const EARTH_RADIUS = 6378.14; // km
const MOON_RADIUS = 1737.4;
const SUN_RADIUS = 696000;
const AU = 149597870.7;
const LONDON = { lat: 51.5, lon: -0.13 };

// Moon terms from Meeus table 47.A and 47.B: D, M, M', F, longitude (1e-6
// degrees), distance (metres). Only the larger ones; enough for eclipses.
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

// Apparent geocentric ecliptic longitude (degrees) and distance (km).
function sun(T: number): [number, number, number] {
  const L0 = 280.46646 + 36000.76983 * T;
  const M = 357.52911 + 35999.05029 * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const v = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(v));
  const omega = 125.04 - 1934.136 * T;
  return [norm(L0 + C - 0.00569 - 0.00478 * sin(omega)), 0, R * AU];
}

type Vec = [number, number, number];

// Ecliptic to equatorial rectangular coordinates, in km.
function equatorial([lon, lat, dist]: [number, number, number], T: number): Vec {
  const eps = 23.4392911 - 0.0130042 * T;
  const x = dist * cos(lat) * cos(lon), y = dist * cos(lat) * sin(lon), z = dist * sin(lat);
  return [x, y * cos(eps) - z * sin(eps), y * sin(eps) + z * cos(eps)];
}

function observer(ms: number, place: { lat: number; lon: number }): Vec {
  const jd = ms / 86400000 + 2440587.5;
  const lst = norm(280.46061837 + 360.98564736629 * (jd - 2451545) + place.lon);
  return [EARTH_RADIUS * cos(place.lat) * cos(lst), EARTH_RADIUS * cos(place.lat) * sin(lst), EARTH_RADIUS * sin(place.lat)];
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec) => Math.hypot(...a);
const angle = (a: Vec, b: Vec) => deg(Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b)))));
const altitude = (target: Vec, obs: Vec) => 90 - angle(sub(target, obs), obs);

// Moon's elongation from the Sun in longitude, in (-180, 180].
function elongation(ms: number): number {
  const T = centuries(ms);
  return ((moon(T)[0] - sun(T)[0]) % 360 + 540) % 360 - 180;
}

// Time when the elongation crosses `target` (0 for new, 180 for full) near
// a guess, by bisection over a two-day bracket.
function phaseNear(guess: number, target: number): number {
  const f = (ms: number) => ((elongation(ms) - target) % 360 + 540) % 360 - 180;
  let lo = guess - 2 * 86400000, hi = guess + 2 * 86400000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

// Minimises f over [a, b] by golden-section search.
function minimise(f: (x: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  for (let i = 0; i < 60; i++) {
    if (f(c) < f(d)) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

// Share of the Sun's disc (radius rs) hidden by the Moon's (radius rm) when
// their centres are d apart: the area where two circles overlap.
function overlap(rs: number, rm: number, d: number): number {
  if (d >= rs + rm) return 0;
  if (d <= Math.abs(rm - rs)) return rm >= rs ? 1 : (rm * rm) / (rs * rs);
  const a = rs * rs * Math.acos((d * d + rs * rs - rm * rm) / (2 * d * rs));
  const b = rm * rm * Math.acos((d * d + rm * rm - rs * rs) / (2 * d * rm));
  const c = 0.5 * Math.sqrt((-d + rs + rm) * (d + rs - rm) * (d - rs + rm) * (d + rs + rm));
  return (a + b - c) / (Math.PI * rs * rs);
}

export interface Eclipse {
  kind: "solar" | "lunar";
  type: string;
  at: Date;
  uk: string | null;
}

function solar(newMoon: number): Eclipse | null {
  const geo = (ms: number) => {
    const T = centuries(ms);
    const m = moon(T), s = sun(T);
    return { m: equatorial(m, T), s: equatorial(s, T), md: m[2], sd: s[2] };
  };
  const sepAt = (ms: number) => {
    const g = geo(ms);
    return angle(g.m, g.s);
  };
  const best = minimise(sepAt, newMoon - 0.4 * 86400000, newMoon + 0.4 * 86400000);
  const g = geo(best);
  const sep = sepAt(best);
  const parallax = deg(Math.asin(EARTH_RADIUS / g.md));
  const sunR = deg(Math.asin(SUN_RADIUS / g.sd));
  const sunPar = deg(Math.asin(EARTH_RADIUS / g.sd));
  const moonR = deg(Math.asin(MOON_RADIUS / g.md));
  if (sep > parallax - sunPar + moonR + sunR) return null;

  let type = "Partial";
  const gamma = sep / parallax;
  if (gamma < 0.9972) {
    // Compare the Moon's and Sun's sizes where the shadow axis meets the
    // Earth, and at the Earth's centre, which stands in for the ends of the
    // track. Total at both is total; annular at both is annular.
    const near = deg(Math.asin(MOON_RADIUS / (g.md - EARTH_RADIUS * Math.sqrt(1 - gamma * gamma))));
    const far = moonR;
    type = near < sunR ? "Annular" : far >= sunR ? "Total" : "Hybrid";
  }

  // From London: the largest share of the Sun's area covered while the
  // Sun is above the horizon.
  const covered = (ms: number) => {
    const T = centuries(ms);
    const m = equatorial(moon(T), T), s = equatorial(sun(T), T);
    const o = observer(ms, LONDON);
    const tm = sub(m, o), ts = sub(s, o);
    if (altitude(s, o) < -0.8) return 0;
    const rm = deg(Math.asin(MOON_RADIUS / len(tm))), rs = deg(Math.asin(SUN_RADIUS / len(ts)));
    return overlap(rs, rm, angle(tm, ts));
  };
  let uk: string | null = null;
  let peak = 0, peakAt = 0;
  for (let ms = best - 4 * 3600000; ms <= best + 4 * 3600000; ms += 120000) {
    const c = covered(ms);
    if (c > peak) {
      peak = c;
      peakAt = ms;
    }
  }
  if (peak > 0.005) {
    const t = minimise((ms) => -covered(ms), peakAt - 240000, peakAt + 240000);
    uk = `partial from the UK, ${Math.round(Math.min(peak, 1) * 100)}% of the Sun covered at ${time(new Date(t))}`;
  }
  return { kind: "solar", type, at: new Date(best), uk };
}

function lunar(fullMoon: number): Eclipse | null {
  const state = (ms: number) => {
    const T = centuries(ms);
    const m = moon(T), s = sun(T);
    const me = equatorial(m, T), se = equatorial(s, T);
    const anti: Vec = [-se[0], -se[1], -se[2]];
    return { sep: angle(me, anti), md: m[2], sd: s[2], me };
  };
  const best = minimise((ms) => state(ms).sep, fullMoon - 0.4 * 86400000, fullMoon + 0.4 * 86400000);
  const s = state(best);
  const parallax = deg(Math.asin(EARTH_RADIUS / s.md));
  const sunPar = deg(Math.asin(EARTH_RADIUS / s.sd));
  const sunR = deg(Math.asin(SUN_RADIUS / s.sd));
  const moonR = deg(Math.asin(MOON_RADIUS / s.md));
  // Shadow radii, enlarged by 1/50 for the Earth's atmosphere (Danjon).
  const umbra = 1.02 * (0.99834 * parallax - sunR + sunPar);
  const penumbra = 1.02 * (0.99834 * parallax + sunR + sunPar);
  let type: string;
  if (s.sep < umbra - moonR) type = "Total";
  else if (s.sep < umbra + moonR) type = "Partial";
  else if (s.sep < penumbra + moonR) type = "Penumbral";
  else return null;

  // Visible from London if the Moon is up at greatest eclipse, or within an
  // hour either side, which covers most of a long eclipse.
  let uk: string | null = null;
  const up = [-3600000, 0, 3600000].filter((dt) => {
    const st = state(best + dt);
    return altitude(st.me, observer(best + dt, LONDON)) > 0;
  });
  if (up.length === 3) uk = "visible from the UK";
  else if (up.length) uk = "partly visible from the UK, with the Moon low";
  if (type === "Penumbral" && uk) uk += " (a subtle darkening, easy to miss)";
  return { kind: "lunar", type, at: new Date(best), uk };
}

export function eclipses(from: Date, count: number, kinds: Array<"solar" | "lunar">): Eclipse[] {
  const out: Eclipse[] = [];
  const SYNODIC = 29.530588861 * 86400000;
  // Start at the first new moon after a day back, so an eclipse in progress
  // isn't missed. Elongation runs from -180 to 180, and the step where it
  // turns from negative to positive is the new moon.
  let guess = from.getTime() - 86400000;
  while (!(elongation(guess) < 0 && elongation(guess + 6 * 3600000) >= 0)) guess += 6 * 3600000;
  guess += 3 * 3600000;
  for (let i = 0; out.length < count && i < 5000; i++, guess += SYNODIC / 2) {
    const full = i % 2 === 1;
    const t = phaseNear(guess, full ? 180 : 0);
    guess = t;
    if (!kinds.includes(full ? "lunar" : "solar")) continue;
    const e = full ? lunar(t) : solar(t);
    if (e) out.push(e);
  }
  return out;
}

function time(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function day(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(",", "");
}

function main(args: string[]): void {
  let kinds: Array<"solar" | "lunar"> = ["solar", "lunar"];
  let count = 6;
  let ukOnly = false;
  for (const w of args.join(" ").toLowerCase().split(/\s+/).filter(Boolean)) {
    if (w === "solar" || w === "sun") kinds = ["solar"];
    else if (w === "lunar" || w === "moon") kinds = ["lunar"];
    else if (w === "uk" || w === "here" || w === "visible") ukOnly = true;
    else if (/^\d+$/.test(w)) count = Number(w);
    else if (!["next", "eclipse", "eclipses", "of", "the", "from"].includes(w)) {
      console.error(`Not sure what '${w}' means here.`);
      console.error("Try: eclipse, eclipse 12, eclipse solar, eclipse lunar, eclipse uk");
      Deno.exit(1);
    }
  }
  if (count < 1 || count > 50) {
    console.error("Ask for from 1 to 50.");
    Deno.exit(1);
  }
  const found: Eclipse[] = [];
  for (let from = new Date(); found.length < count;) {
    const batch = eclipses(from, 12, kinds);
    found.push(...batch.filter((e) => !ukOnly || e.uk));
    from = new Date(batch.at(-1)!.at.getTime() + 86400000);
    if (from.getFullYear() > new Date().getFullYear() + 200) break;
  }
  const rows = found.slice(0, count);
  const w = Math.max(...rows.map((e) => `${e.type} ${e.kind}`.length));
  for (const e of rows) {
    const label = `${e.type} ${e.kind}`.padEnd(w);
    console.log(`${day(e.at).padEnd(16)} ${time(e.at)}  ${label}  ${e.uk ?? "not visible from the UK"}`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
