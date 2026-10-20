// summary: An alarm that rings at a time of day, while the terminal stays open
//
// Usage:
//   quick alarm 7:30              7:30 in the morning, today or tomorrow
//   quick alarm 6pm
//   quick alarm 18:45 call mum    a label to remind you what it was for
//   quick alarm noon
//
// A bare hour from 1 to 11 means the next one to come, morning or evening:
// "alarm 6" at 3pm rings at 6pm. The alarm only rings while quick is
// running, so leave the window open. It rings until a key is pressed, for up
// to a minute.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const BELL = "\x07";

// Returns the next moment matching the words, and the words left over.
export function parseTime(text: string, now: Date): { at: Date; label: string } | null {
  const words = text.trim().replace(/(\d)\s+(am|pm)\b/gi, "$1$2").split(/\s+/).filter(Boolean);
  while (words.length && /^(at|for)$/i.test(words[0])) words.shift();
  const first = (words.shift() ?? "").toLowerCase();
  let hour: number, minute = 0, ambiguous = false;
  let m;
  if (first === "noon" || first === "midday") hour = 12;
  else if (first === "midnight") hour = 0;
  else if ((m = first.match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/)) || (m = first.match(/^(\d{1,2})(\d{2})(am|pm)?$/))) {
    hour = Number(m[1]);
    minute = Number(m[2] ?? 0);
    if (m[3]) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (m[3] === "pm" ? 12 : 0);
    } else if (hour >= 1 && hour <= 11 && !first.includes(":") && !first.includes(".") && first.length <= 2) {
      ambiguous = true;
    }
  } else {
    return null;
  }
  if (hour > 23 || minute > 59) return null;

  const candidates: Date[] = [];
  for (const h of ambiguous ? [hour, hour + 12] : [hour]) {
    for (const dayOffset of [0, 1]) {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, minute, 0, 0);
      if (d > now) candidates.push(d);
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  while (words.length && /^(to|for|-)$/i.test(words[0])) words.shift();
  return { at: candidates[0], label: words.join(" ") };
}

function timeOfDay(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function ring(message: string): Promise<void> {
  if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
    console.log(BELL + message);
    return;
  }
  write(`${BELL}${message}  (press any key)`);
  Deno.stdin.setRaw(true);
  const reader = Deno.stdin.readable.getReader();
  const key = reader.read();
  try {
    for (let i = 0; i < 60; i++) {
      const done = await Promise.race([key.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), 1000))]);
      if (done) break;
      write(BELL);
    }
  } finally {
    reader.releaseLock();
    Deno.stdin.setRaw(false);
    write("\n");
  }
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: alarm 7:30, alarm 6pm, alarm 18:45 call mum");
  Deno.exit(1);
}

async function main(args: string[]): Promise<void> {
  const now = new Date();
  const parsed = parseTime(args.join(" "), now);
  if (!parsed) fail(args.length ? "Couldn't read a time of day in that." : "What time?");
  const { at, label } = parsed;
  const day = at.getDate() === now.getDate() ? "today" : "tomorrow";
  const intro = `Alarm set for ${timeOfDay(at)} ${day}${label ? ` (${label})` : ""}. Leave this window open.`;

  if (!Deno.stdout.isTerminal()) {
    console.log(intro);
    await new Promise((r) => setTimeout(r, at.getTime() - Date.now()));
  } else {
    console.log(intro);
    // Checks the clock every second rather than sleeping once, so a laptop
    // that wakes from sleep after the alarm time rings straight away.
    for (;;) {
      const left = Math.max(0, Math.ceil((at.getTime() - Date.now()) / 1000));
      write(`\r  ${clock(left)} to go\x1b[K`);
      if (left === 0) break;
      await new Promise((r) => setTimeout(r, Math.min(1000, at.getTime() - Date.now())));
    }
    write("\n");
  }
  await ring(label ? `${timeOfDay(at)}: ${label}.` : `It's ${timeOfDay(at)}.`);
}

if (import.meta.main) {
  await main(Deno.args);
}
