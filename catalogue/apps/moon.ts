// summary: Tonight's moon phase, or when the next full, new or half moon is
//
// Usage:
//   quick moon                    today's phase, drawn
//   quick moon when full          the next few full moons
//   quick moon when new
//   quick moon when half          first and last quarters
//   quick moon when first quarter
//   quick moon when full 6        how many dates to list
//   quick moon south              drawn as seen from the southern hemisphere
//
// The phase is the same everywhere on Earth at a given moment; only its
// orientation in the sky depends on the hemisphere. Event times come from
// Meeus, Astronomical Algorithms, chapter 49, and are good to a minute or two.

type Kind = "new" | "first" | "full" | "last";

interface Event {
  kind: Kind;
  date: Date;
}

const LABELS: Record<Kind, string> = {
  new: "New moon",
  first: "First quarter",
  full: "Full moon",
  last: "Last quarter",
};

const OFFSETS: Record<Kind, number> = { new: 0, first: 0.25, full: 0.5, last: 0.75 };

const SYNODIC_MONTH = 29.530588861;
const DELTA_T_DAYS = 69 / 86400; // TT minus UT, close enough for this century
const rad = (deg: number) => (deg * Math.PI) / 180;
const sin = (deg: number) => Math.sin(rad(deg));
const cos = (deg: number) => Math.cos(rad(deg));

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function fromJulianDay(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

// Time of the phase for lunation k, where k counts new moons from January
// 2000 and the fraction picks the phase.
function phaseTime(k: number, kind: Kind): Date {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const O = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;

  if (kind === "new" || kind === "full") {
    const full = kind === "full";
    jde += (full ? -0.40614 : -0.4072) * sin(Mp) +
      (full ? 0.17302 : 0.17241) * E * sin(M) +
      (full ? 0.01614 : 0.01608) * sin(2 * Mp) +
      (full ? 0.01043 : 0.01039) * sin(2 * F) +
      (full ? 0.00734 : 0.00739) * E * sin(Mp - M) -
      (full ? 0.00515 : 0.00514) * E * sin(Mp + M) +
      (full ? 0.00209 : 0.00208) * E * E * sin(2 * M) -
      0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) +
      0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp) +
      0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) -
      0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O) -
      0.00007 * sin(Mp + 2 * M) + 0.00004 * sin(2 * Mp - 2 * F) +
      0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) +
      0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F) +
      0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F) -
      0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  } else {
    jde += -0.62801 * sin(Mp) + 0.17172 * E * sin(M) -
      0.01183 * E * sin(Mp + M) + 0.00862 * sin(2 * Mp) +
      0.00804 * sin(2 * F) + 0.00454 * E * sin(Mp - M) +
      0.00204 * E * E * sin(2 * M) - 0.0018 * sin(Mp - 2 * F) -
      0.0007 * sin(Mp + 2 * F) - 0.0004 * sin(3 * Mp) -
      0.00034 * E * sin(2 * Mp - M) + 0.00032 * E * sin(M + 2 * F) +
      0.00032 * E * sin(M - 2 * F) - 0.00028 * E * E * sin(Mp + 2 * M) +
      0.00027 * E * sin(2 * Mp + M) - 0.00017 * sin(O) -
      0.00005 * sin(Mp - M - 2 * F) + 0.00004 * sin(2 * Mp + 2 * F) -
      0.00004 * sin(Mp + M + 2 * F) + 0.00004 * sin(Mp - 2 * M) +
      0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(3 * M) +
      0.00002 * sin(2 * Mp - 2 * F) + 0.00002 * sin(Mp - M + 2 * F) -
      0.00002 * sin(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * cos(M) + 0.00026 * cos(Mp) -
      0.00002 * cos(Mp - M) + 0.00002 * cos(Mp + M) + 0.00002 * cos(2 * F);
    jde += kind === "first" ? W : -W;
  }

  // Small corrections for the pull of the planets.
  const planetary: Array<[number, number, number]> = [
    [299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165],
    [251.83, 26.651886, 0.000164], [349.42, 36.412478, 0.000126],
    [84.66, 18.206239, 0.00011], [141.74, 53.303771, 0.000062],
    [207.14, 2.453732, 0.00006], [154.84, 7.30686, 0.000056],
    [34.52, 27.261239, 0.000047], [207.19, 0.121824, 0.000042],
    [291.34, 1.844379, 0.00004], [161.72, 24.198154, 0.000037],
    [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023],
  ];
  for (const [i, [a, b, c]] of planetary.entries()) {
    jde += c * sin(a + b * k - (i === 0 ? 0.009173 * T2 : 0));
  }
  return fromJulianDay(jde - DELTA_T_DAYS);
}

// Every principal phase from about a month before `from` onwards, in order.
function events(from: Date, count: number): Event[] {
  const start = Math.floor((julianDay(from) - 2451550.09766) / SYNODIC_MONTH) - 1;
  const out: Event[] = [];
  for (let k = start; out.length < count; k++) {
    for (const kind of ["new", "first", "full", "last"] as Kind[]) {
      out.push({ kind, date: phaseTime(k + OFFSETS[kind], kind) });
    }
  }
  return out;
}

// Fraction of the disc that is lit, and whether it is growing. Meeus,
// chapter 48, low-precision method: good to about one percent.
function illumination(date: Date): { lit: number; waxing: boolean } {
  const T = (julianDay(date) + DELTA_T_DAYS - 2451545) / 36525;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) -
    0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  return { lit: (1 + cos(i)) / 2, waxing: ((D % 360) + 360) % 360 < 180 };
}

function draw(lit: number, waxing: boolean, south: boolean): string {
  const rows = 11, cols = 22;
  // Position of the boundary between light and dark, from -1 (left edge)
  // to 1 (right edge), as a fraction of the disc's half-width.
  const edge = 1 - 2 * lit;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const y = 1 - (2 * r + 1) / rows;
    let line = "";
    for (let c = 0; c < cols; c++) {
      let x = -1 + (2 * c + 1) / cols;
      if (x * x + y * y > 1) {
        line += " ";
        continue;
      }
      if (south) x = -x;
      const half = Math.sqrt(1 - y * y);
      line += (waxing ? x > edge * half : x < -edge * half) ? "█" : "░";
    }
    lines.push("  " + line.trimEnd());
  }
  return lines.join("\n");
}

const DAY = 86400000;

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function daysFromToday(date: Date, now: Date): number {
  const midnight = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((midnight(date) - midnight(now)) / DAY);
}

function relative(date: Date, now: Date): string {
  const days = daysFromToday(date, now);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

function day(date: Date, now: Date): string {
  const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-GB", o);
  const year = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${part({ weekday: "short" })} ${date.getDate()} ${part({ month: "short" })}${year}`;
}

function time(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function phaseName(now: Date, all: Event[]): string {
  const today = all.find((e) => sameDay(e.date, now));
  if (today) return LABELS[today.kind];
  const last = all.filter((e) => e.date <= now).at(-1)!;
  return {
    new: "Waxing crescent",
    first: "Waxing gibbous",
    full: "Waning gibbous",
    last: "Waning crescent",
  }[last.kind];
}

function isBlueMoon(e: Event, all: Event[]): boolean {
  return e.kind === "full" && all.some((o) =>
    o.kind === "full" && o.date < e.date &&
    o.date.getMonth() === e.date.getMonth() && o.date.getFullYear() === e.date.getFullYear()
  );
}

function showToday(now: Date, south: boolean): void {
  const all = events(now, 12);
  const { lit, waxing } = illumination(now);
  const lastNew = all.filter((e) => e.kind === "new" && e.date <= now).at(-1)!;
  const age = (now.getTime() - lastNew.date.getTime()) / DAY;
  console.log();
  console.log(draw(lit, waxing, south));
  console.log();
  console.log(`${phaseName(now, all)}, ${Math.round(lit * 100)}% lit, ${age.toFixed(1)} days old`);
  for (const kind of ["full", "new"] as Kind[]) {
    const next = all.find((e) => e.kind === kind && e.date > now)!;
    console.log(`${LABELS[kind]} ${relative(next.date, now)}, ${day(next.date, now)} at ${time(next.date)}`);
  }
}

function showUpcoming(now: Date, kinds: Kind[], count: number): void {
  const all = events(now, 4 * (count + 2) * (kinds.length === 1 ? 1 : 0.5) + 8);
  const upcoming = all.filter((e) => kinds.includes(e.kind) && e.date > now).slice(0, count);
  const labelWidth = Math.max(...upcoming.map((e) => LABELS[e.kind].length));
  const dayWidth = Math.max(...upcoming.map((e) => day(e.date, now).length));
  for (const e of upcoming) {
    const label = kinds.length > 1 ? LABELS[e.kind].padEnd(labelWidth) + "  " : "";
    const blue = isBlueMoon(e, all) ? "  (blue moon)" : "";
    console.log(`${label}${day(e.date, now).padEnd(dayWidth)}  ${time(e.date)}  ${relative(e.date, now)}${blue}`);
  }
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: moon, moon when full, moon when new, moon when half, moon south");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  const filler = new Set(["when", "is", "the", "next", "a", "moon", "moons", "s", "few", "dates"]);
  let south = false;
  let count: number | null = null;
  let kinds: Kind[] | null = null;
  for (const w of words) {
    if (filler.has(w)) continue;
    if (/^\d+$/.test(w)) count = Number(w);
    else if (w === "south" || w === "southern") south = true;
    else if (w === "north" || w === "northern") south = false;
    else if (w === "full") kinds = ["full"];
    else if (w === "new") kinds = ["new"];
    else if (w === "half" || w === "halves" || w === "quarter" || w === "quarters") kinds ??= ["first", "last"];
    else if (w === "first") kinds = ["first"];
    else if (w === "last" || w === "third") kinds = ["last"];
    else fail(`Not sure what '${w}' means here.`);
  }
  const now = new Date();
  if (kinds === null) {
    if (count !== null) fail("A number only makes sense with full, new or half.");
    showToday(now, south);
  } else {
    if (count !== null && (count < 1 || count > 100)) fail("Pick a number from 1 to 100.");
    showUpcoming(now, kinds, count ?? 4);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
