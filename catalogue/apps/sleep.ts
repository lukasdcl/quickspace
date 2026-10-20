// summary: Good times to wake up or go to bed, counting in sleep cycles
//
// Usage:
//   quick sleep               going to bed now: when to set the alarm
//   quick sleep wake 7:00     need to be up at 7: when to go to bed
//   quick sleep at 23:30      going to bed at 11:30: when to set the alarm
//
// Sleep runs in cycles of about 90 minutes, and waking at the end of one
// tends to feel easier than waking in the middle. It also allows about 15
// minutes to fall asleep. Both are averages; people vary, so treat the
// times as a guide rather than a rule.

const CYCLE = 90;
const FALL_ASLEEP = 15;

function parseTime(text: string): { h: number; m: number } | null {
  const t = text.toLowerCase().replace(/\s+/g, "");
  let m = t.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/);
  if (!m) m = t.match(/^(\d{1,2})(\d{2})(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3] === "pm" ? 12 : 0);
  }
  return h <= 23 && min <= 59 ? { h, m: min } : null;
}

function at(base: Date, h: number, m: number, after: boolean): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  if (after && d <= base) d.setDate(d.getDate() + 1);
  if (!after && d >= base) d.setDate(d.getDate() - 1);
  return d;
}

const fmt = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const hours = (cycles: number) => `${(cycles * CYCLE) / 60} hours`.replace(".5 hours", " and a half hours");

function fail(message: string): never {
  console.error(message);
  console.error("Try: sleep, sleep wake 7:00, sleep at 23:30");
  Deno.exit(1);
}

function main(args: string[]): void {
  const text = args.join(" ").toLowerCase().trim();
  const now = new Date();
  now.setSeconds(0, 0);

  const wake = text.match(/^(?:wake|wake up|up|get up|alarm|by)(?: at| by)? (.+)$/);
  if (wake) {
    const t = parseTime(wake[1]);
    if (!t) fail(`Couldn't read '${wake[1]}' as a time.`);
    const up = at(now, t.h, t.m, true);
    console.log(`To wake at ${fmt(up)}, go to bed at one of these:`);
    for (const cycles of [6, 5, 4]) {
      const bed = new Date(up.getTime() - (cycles * CYCLE + FALL_ASLEEP) * 60000);
      const note = bed < now ? "  (already passed)" : "";
      console.log(`  ${fmt(bed)}   ${cycles} cycles, ${hours(cycles)}${note}`);
    }
    return;
  }

  let bed = now;
  const bedText = text.replace(/^(?:bed|bedtime|at|going to bed at|from)\s*(?:at\s*)?/, "");
  if (bedText) {
    const t = parseTime(bedText);
    if (!t) fail(`Couldn't read '${bedText}' as a time.`);
    bed = at(now, t.h, t.m, true);
  }
  const asleep = new Date(bed.getTime() + FALL_ASLEEP * 60000);
  console.log(`${bedText ? `In bed at ${fmt(bed)}` : "Going to bed now"}, set the alarm for one of these:`);
  for (const cycles of [4, 5, 6]) {
    const up = new Date(asleep.getTime() + cycles * CYCLE * 60000);
    console.log(`  ${fmt(up)}   ${cycles} cycles, ${hours(cycles)}`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
