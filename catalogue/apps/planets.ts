// summary: Which planets you can see tonight or before dawn, and how bright they are
//
// Usage:
//   quick planets             tonight
//   quick planets 25/12       another date
//
// Covers the five planets visible without a telescope. Positions come from
// NASA JPL's approximate orbital elements for 1800 to 2050, which are good
// to a fraction of a degree, plenty for saying where to look.
//
// Whether a planet is in the evening or morning sky depends only on its
// angle from the Sun as seen from Earth (its elongation), which is the same
// for everyone, so no location is needed. How high it gets does depend on
// where you are; the descriptions are for mid-northern latitudes like the
// UK's.

interface Elements {
  name: string;
  el: number[]; // a, e, I, L, long. perihelion, long. node
  rate: number[]; // per Julian century
}

// Standish, "Keplerian Elements for Approximate Positions of the Major
// Planets", table 1.
const PLANETS: Elements[] = [
  { name: "Mercury", el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { name: "Venus", el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  { name: "Earth", el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
  { name: "Mars", el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { name: "Jupiter", el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { name: "Saturn", el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
type Vec = [number, number, number];

// Heliocentric ecliptic position in astronomical units.
function position(p: Elements, T: number): Vec {
  const [a, e, I, L, wbar, node] = p.el.map((v, i) => v + p.rate[i] * T);
  const w = wbar - node;
  let M = ((L - wbar) % 360 + 540) % 360 - 180;
  M = rad(M);
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(rad(w)), sw = Math.sin(rad(w));
  const cn = Math.cos(rad(node)), sn = Math.sin(rad(node));
  const ci = Math.cos(rad(I)), si = Math.sin(rad(I));
  return [
    (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y,
    (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y,
    sw * si * x + cw * si * y,
  ];
}

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: Vec) => Math.hypot(...a);
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lon = (a: Vec) => deg(Math.atan2(a[1], a[0]));

// Visual magnitude from distances and phase angle, Meeus chapter 41.
function magnitude(name: string, r: number, d: number, i: number): number {
  const base = 5 * Math.log10(r * d);
  switch (name) {
    case "Mercury": return -0.42 + base + 0.038 * i - 0.000273 * i * i + 0.000002 * i ** 3;
    case "Venus": return -4.4 + base + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i ** 3;
    case "Mars": return -1.52 + base + 0.016 * i;
    case "Jupiter": return -9.4 + base + 0.005 * i;
    default: return -8.88 + base + 0.044 * i;
  }
}

export interface Sighting {
  name: string;
  elongation: number; // degrees, positive when east of the Sun
  mag: number;
  distance: number; // AU from Earth
}

export function sightings(date: Date): Sighting[] {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  const earth = position(PLANETS[2], T);
  const sunLon = lon(sub([0, 0, 0], earth));
  return PLANETS.filter((p) => p.name !== "Earth").map((p) => {
    const helio = position(p, T);
    const geo = sub(helio, earth);
    const r = len(helio), d = len(geo);
    const phase = deg(Math.acos(dot(helio, geo) / (r * d)));
    const toSun = sub([0, 0, 0], earth);
    let elong = deg(Math.acos(dot(geo, toSun) / (d * len(toSun))));
    const diff = ((lon(geo) - sunLon) % 360 + 540) % 360 - 180;
    if (diff < 0) elong = -elong;
    return { name: p.name, elongation: elong, mag: magnitude(p.name, r, d, phase), distance: d };
  });
}

function brightness(mag: number): string {
  if (mag < -3) return "dazzling, the brightest thing in the sky after the Moon";
  if (mag < -1.5) return "very bright";
  if (mag < 0) return "bright";
  if (mag < 1.5) return "easy to see";
  return "faint, best away from town lights";
}

function where(s: Sighting): string | null {
  const e = Math.abs(s.elongation);
  const inner = s.name === "Mercury" || s.name === "Venus";
  if (e < (s.name === "Mercury" ? 12 : 10)) return null;
  if (!inner && e > 150) return "up all night, rising in the east around sunset";
  if (s.elongation > 0) {
    if (!inner && e > 90) return "in the south and east in the evening, setting after midnight";
    return e < 25 ? "low in the west just after sunset" : "in the west after sunset";
  }
  if (!inner && e > 90) return "rises before midnight, highest in the small hours";
  return e < 25 ? "low in the east just before sunrise" : "in the east before sunrise";
}

function parseDate(text: string): Date | null {
  const t = text.trim().toLowerCase();
  if (t === "" || t === "tonight" || t === "today") return new Date();
  if (t === "tomorrow") return new Date(Date.now() + 86400000);
  const m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?$/) ?? t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const iso = t.includes("-");
  const y = Number(iso ? m[1] : m[3] ?? new Date().getFullYear());
  const mo = Number(m[2]), d = Number(iso ? m[3] : m[1]);
  const date = new Date(y, mo - 1, d, 21, 0);
  return date.getMonth() === mo - 1 ? date : null;
}

function main(args: string[]): void {
  const date = parseDate(args.join(" "));
  if (!date) {
    console.error("Couldn't read that as a date.");
    console.error("Try: planets, planets 25/12, planets 2027-03-01");
    Deno.exit(1);
  }
  if (date.getFullYear() < 1800 || date.getFullYear() > 2050) {
    console.error("Positions are only good from 1800 to 2050.");
    Deno.exit(1);
  }
  const all = sightings(date);
  const visible = all.filter((s) => where(s) !== null).sort((a, b) => a.mag - b.mag);
  const hidden = all.filter((s) => where(s) === null);
  const width = Math.max(...all.map((s) => s.name.length));
  if (visible.length === 0) console.log("None of the bright planets are well placed.");
  for (const s of visible) {
    console.log(`${s.name.padEnd(width)}  ${where(s)}; ${brightness(s.mag)} (magnitude ${s.mag.toFixed(1)})`);
  }
  if (hidden.length) {
    console.log(`${hidden.map((s) => s.name).join(" and ")} ${hidden.length === 1 ? "is" : "are"} too close to the Sun to see.`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
