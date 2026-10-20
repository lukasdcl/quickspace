// summary: A countdown timer that rings when time is up
//
// Usage:
//   quick timer 10            ten minutes
//   quick timer 90s
//   quick timer 1h30
//   quick timer 4m eggs       a label to remind you what it was for
//   quick timer 25 minutes for the oven
//
// Durations are minutes unless they say otherwise. When time is up the
// terminal bell rings until a key is pressed, for up to a minute.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const BELL = "\x07";

const DURATION = /^(?:(\d+(?:\.\d+)?)(?:h|hrs?|hours?))?(?:(\d+(?:\.\d+)?)(m|mins?|minutes?|s|secs?|seconds?)?)?$/i;

// Finds the first length of time in the words; the rest is the label.
export function parseDuration(text: string): { seconds: number; label: string } | null {
  const words = text
    .replace(/(\d)\s+(h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)\b/gi, "$1$2")
    .split(/\s+/).filter(Boolean);
  const i = words.findIndex((w) => {
    const m = w.match(DURATION);
    return m !== null && (m[1] !== undefined || m[2] !== undefined);
  });
  if (i < 0) return null;
  const m = words[i].match(DURATION)!;
  const unit = (m[3] ?? "m").toLowerCase();
  const seconds = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * (unit.startsWith("s") ? 1 : 60);
  const rest = [...words.slice(0, i), ...words.slice(i + 1)];
  while (rest.length && /^(for|to|a|timer)$/i.test(rest[0])) rest.shift();
  return seconds > 0 ? { seconds: Math.round(seconds), label: rest.join(" ") } : null;
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function timeOfDay(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// Rings once a second until a key is pressed or a minute has passed.
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
  console.error("Try: timer 10, timer 90s, timer 1h30, timer 4m eggs");
  Deno.exit(1);
}

async function main(args: string[]): Promise<void> {
  const parsed = parseDuration(args.join(" "));
  if (!parsed) fail(args.length ? "Couldn't find a length of time in that." : "How long for?");
  const { seconds, label } = parsed;
  if (seconds > 24 * 3600) fail("That's longer than a day.");
  const end = Date.now() + seconds * 1000;

  if (!Deno.stdout.isTerminal()) {
    console.log(`Timer set until ${timeOfDay(new Date(end))}.`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
  } else {
    // Worked out from the clock on every tick, so it never drifts.
    for (;;) {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      const width = 30;
      const filled = Math.round(width * (1 - left / seconds));
      write(`\r  ${clock(left).padStart(8)}  ${"█".repeat(filled)}${"░".repeat(width - filled)}  until ${timeOfDay(new Date(end))}${label ? "  " + label : ""}\x1b[K`);
      if (left === 0) break;
      await new Promise((r) => setTimeout(r, end - Date.now() - (left - 1) * 1000));
    }
    write("\n");
  }
  await ring(label ? `Time's up: ${label}.` : "Time's up.");
}

if (import.meta.main) {
  await main(Deno.args);
}
