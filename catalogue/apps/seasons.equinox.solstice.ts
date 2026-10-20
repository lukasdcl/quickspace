// summary: The next equinoxes and solstices, and how much daylight is changing
//
// Usage:
//   quick seasons             the next four
//   quick seasons 2027        all four in a year
//
// Times come from Meeus, Astronomical Algorithms, chapter 27, and are good
// to about a minute. They are shown in this computer's time zone. Seasons
// here are astronomical ones; the Met Office counts them from the 1st of
// March, June, September and December instead.

type Kind = "march" | "june" | "september" | "december";
const KINDS: Kind[] = ["march", "june", "september", "december"];
const NAMES: Record<Kind, string> = {
  march: "March equinox",
  june: "June solstice",
  september: "September equinox",
  december: "December solstice",
};
const NORTH: Record<Kind, string> = {
  march: "first day of spring, day and night roughly equal",
  june: "first day of summer, the longest day",
  september: "first day of autumn, day and night roughly equal",
  december: "first day of winter, the shortest day",
};

const rad = (deg: number) => (deg * Math.PI) / 180;

// Mean times for years 2000 to 3000, Meeus table 27.B.
const MEAN: Record<Kind, number[]> = {
  march: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  june: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  september: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  december: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

// Periodic terms, Meeus table 27.C: amplitude, phase, rate.
const TERMS: Array<[number, number, number]> = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
  [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
  [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
  [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
  [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
  [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
  [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];

export function eventTime(year: number, kind: Kind): Date {
  const Y = (year - 2000) / 1000;
  const [a, b, c, d, e] = MEAN[kind];
  const jde0 = a + b * Y + c * Y ** 2 + d * Y ** 3 + e * Y ** 4;
  const T = (jde0 - 2451545) / 36525;
  const W = 35999.373 * T - 2.47;
  const dL = 1 + 0.0334 * Math.cos(rad(W)) + 0.0007 * Math.cos(rad(2 * W));
  const S = TERMS.reduce((sum, [A, B, C]) => sum + A * Math.cos(rad(B + C * T)), 0);
  const jde = jde0 + (0.00001 * S) / dL;
  // Terrestrial time to universal time; about 69 seconds this century.
  const deltaT = 69 / 86400;
  return new Date((jde - deltaT - 2440587.5) * 86400000);
}

function fmt(d: Date, withYear: boolean): string {
  const date = d.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
  }).replace(",", "");
  return `${date} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function daysUntil(d: Date, now: Date): string {
  const mid = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const n = Math.round((mid(d) - mid(now)) / 86400000);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  const now = new Date();
  const south = words.includes("south") || words.includes("southern");
  const yearWord = words.find((w) => /^\d{4}$/.test(w));
  const other = words.filter((w) => w !== yearWord && !["south", "southern", "north", "northern"].includes(w));
  if (other.length) {
    console.error(`Not sure what '${other[0]}' means here.`);
    console.error("Try: seasons, seasons 2027");
    Deno.exit(1);
  }
  const flip: Record<Kind, Kind> = { march: "september", june: "december", september: "march", december: "june" };
  const note = (k: Kind) => NORTH[south ? flip[k] : k];

  if (yearWord) {
    const year = Number(yearWord);
    if (year < 1000 || year > 3000) {
      console.error("Pick a year from 1000 to 3000.");
      Deno.exit(1);
    }
    for (const k of KINDS) console.log(`${NAMES[k].padEnd(18)} ${fmt(eventTime(year, k), false)}   ${note(k)}`);
    return;
  }
  const upcoming: Array<{ k: Kind; d: Date }> = [];
  for (let y = now.getFullYear(); upcoming.length < 4; y++) {
    for (const k of KINDS) {
      const d = eventTime(y, k);
      if (d > now && upcoming.length < 4) upcoming.push({ k, d });
    }
  }
  for (const { k, d } of upcoming) {
    console.log(`${NAMES[k].padEnd(18)} ${fmt(d, true).padEnd(26)} ${daysUntil(d, now)}`);
  }
  console.log(`\nThe next one is the ${note(upcoming[0].k)}${south ? " in the southern hemisphere" : ""}.`);
}

if (import.meta.main) {
  main(Deno.args);
}
