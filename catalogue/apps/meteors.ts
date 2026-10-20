// summary: When the next meteor showers peak, and whether the Moon will spoil them
//
// Usage:
//   quick meteors             the next four showers
//   quick meteors all         every major shower in the coming year
//   quick meteors perseids    one shower by name
//
// Showers happen when the Earth crosses a trail of comet dust, which it
// does at the same point in its orbit every year, so the peak dates barely
// move and a fixed table is enough. They can shift by a day either way.
// Rates are the most a single observer would see under a perfectly dark sky
// with the shower's radiant overhead (the zenithal hourly rate); expect a
// third to a half of that from a typical garden. The Moon's brightness uses
// the same method as quick moon.

interface Shower {
  name: string;
  month: number;
  day: number; // the morning the peak night ends, in UK time
  rate: number;
  best: string;
  note?: string;
}

const SHOWERS: Shower[] = [
  { name: "Quadrantids", month: 1, day: 4, rate: 110, best: "in the hours before dawn", note: "a short peak of only a few hours" },
  { name: "Lyrids", month: 4, day: 22, rate: 18, best: "after midnight" },
  { name: "Eta Aquariids", month: 5, day: 6, rate: 50, best: "just before dawn", note: "the radiant stays low from the UK, so far fewer are seen" },
  { name: "Southern Delta Aquariids", month: 7, day: 30, rate: 25, best: "around 2am", note: "low from the UK" },
  { name: "Perseids", month: 8, day: 13, rate: 100, best: "after midnight", note: "the most reliable shower of the year" },
  { name: "Draconids", month: 10, day: 9, rate: 10, best: "in the evening", note: "usually quiet, with rare outbursts" },
  { name: "Orionids", month: 10, day: 21, rate: 20, best: "after midnight" },
  { name: "Northern Taurids", month: 11, day: 12, rate: 5, best: "around midnight", note: "few meteors, but known for bright fireballs" },
  { name: "Leonids", month: 11, day: 17, rate: 15, best: "in the hours before dawn" },
  { name: "Geminids", month: 12, day: 14, rate: 150, best: "from mid-evening onwards", note: "usually the best shower of the year" },
  { name: "Ursids", month: 12, day: 22, rate: 10, best: "all night" },
];

const rad = (d: number) => (d * Math.PI) / 180;
const sin = (d: number) => Math.sin(rad(d));
const cos = (d: number) => Math.cos(rad(d));

// Fraction of the Moon's disc lit, Meeus chapter 48, low-precision method.
function moonLit(date: Date): number {
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  const D = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) -
    0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  return (1 + cos(i)) / 2;
}

function moonVerdict(lit: number): string {
  if (lit < 0.25) return "dark skies, good conditions";
  if (lit < 0.6) return "some moonlight";
  if (lit < 0.85) return "a bright Moon will hide the fainter ones";
  return "a near-full Moon will wash out most of them";
}

function peakDate(s: Shower, year: number): Date {
  // 2am on the peak morning, about when most showers are at their best.
  return new Date(year, s.month - 1, s.day, 2, 0);
}

function nightOf(d: Date): string {
  const eve = new Date(d.getTime() - 86400000);
  const short = (x: Date, o: Intl.DateTimeFormatOptions) => x.toLocaleDateString("en-GB", o);
  const month = (x: Date) => short(x, { month: "short" });
  const range = eve.getMonth() === d.getMonth()
    ? `${eve.getDate()}/${d.getDate()} ${month(d)}`
    : `${eve.getDate()} ${month(eve)}/${d.getDate()} ${month(d)}`;
  return `night of ${short(eve, { weekday: "short" })} ${range} ${d.getFullYear()}`;
}

function describe(s: Shower, at: Date, now: Date): string[] {
  const lit = moonLit(at);
  const days = Math.round((at.getTime() - now.getTime()) / 86400000);
  const when = days <= 0 ? "tonight" : days === 1 ? "tomorrow night" : `in ${days} days`;
  return [
    `${s.name}: ${nightOf(at)}, ${when}`,
    `  Up to ${s.rate} an hour at best, ${s.best}${s.note ? `; ${s.note}` : ""}.`,
    `  Moon ${Math.round(lit * 100)}% lit: ${moonVerdict(lit)}.`,
  ];
}

function main(args: string[]): void {
  const text = args.join(" ").toLowerCase().trim();
  const now = new Date();
  // Keep tonight's shower in the list until the morning after the peak.
  const cutoff = new Date(now.getTime() - 8 * 3600000);
  const upcoming: Array<{ s: Shower; at: Date }> = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const s of SHOWERS) {
      const at = peakDate(s, y);
      if (at > cutoff) upcoming.push({ s, at });
    }
  }
  let list = upcoming;
  if (text === "" || text === "next") list = upcoming.slice(0, 4);
  else if (text === "all" || text === "year") list = upcoming.slice(0, SHOWERS.length);
  else {
    const key = text.replace(/\s+/g, "").replace(/s$/, "");
    list = upcoming.filter(({ s }) => s.name.toLowerCase().replace(/\s+/g, "").replace(/s$/, "").includes(key)).slice(0, 1);
    if (list.length === 0) {
      console.error(`No shower called '${text}'.`);
      console.error(`Showers: ${SHOWERS.map((s) => s.name).join(", ")}`);
      Deno.exit(1);
    }
  }
  console.log(list.map(({ s, at }) => describe(s, at, now).join("\n")).join("\n\n"));
}

if (import.meta.main) {
  main(Deno.args);
}
