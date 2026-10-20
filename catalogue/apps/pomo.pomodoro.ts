// summary: A pomodoro focus timer that rings when time is up
//
// Usage:
//   quick pomo                    25 minutes of focus
//   quick pomo 50                 50 minutes
//   quick pomo 25 5               25 minutes, then a 5 minute break
//   quick pomo 25 5 x4            four rounds of that
//   quick pomo 1h30
//
// Durations are minutes unless they say otherwise: 90s, 45m, 1h, 1h30.
// The terminal bell rings at the end of each stretch. Ctrl-C stops it.

interface Plan {
  focus: number; // seconds
  rest: number;
  rounds: number;
}

function parseDuration(word: string): number | null {
  const m = word.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)(m|min|mins|s|sec|secs)?)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const hours = Number(m[1] ?? 0);
  const value = Number(m[2] ?? 0);
  const unit = m[3] ?? "m";
  const seconds = hours * 3600 + (unit.startsWith("s") ? value : value * 60);
  return seconds > 0 ? Math.round(seconds) : null;
}

function parsePlan(args: string[]): Plan {
  const words = args.join(" ").toLowerCase()
    .replace(/(\d)\s+(h|hr|hrs|hours?|m|mins?|minutes?|s|secs?|seconds?)\b/g, "$1$2")
    .replace(/(\d)(hours?|hrs?)/g, "$1h").replace(/(\d)minutes?/g, "$1m").replace(/(\d)seconds?/g, "$1s")
    .split(/\s+/).filter(Boolean);
  const filler = new Set(["for", "with", "a", "and", "then", "break", "breaks", "rest", "focus", "of", "minute", "minutes"]);
  const durations: number[] = [];
  let rounds = 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (filler.has(w)) continue;
    const times = w.match(/^x(\d+)$/) ?? w.match(/^(\d+)x$/);
    if (times) {
      rounds = Number(times[1]);
      continue;
    }
    if (/^\d+$/.test(w) && /^(times|rounds?)$/.test(words[i + 1] ?? "")) {
      rounds = Number(w);
      i++;
      continue;
    }
    const d = parseDuration(w);
    if (d === null) fail(`Not sure what '${w}' means here.`);
    durations.push(d);
  }
  if (durations.length > 2) fail("Give at most two times: focus, then break.");
  if (rounds < 1 || rounds > 24) fail("Pick from 1 to 24 rounds.");
  const [focus = 25 * 60, rest = 0] = durations;
  if (focus > 12 * 3600 || rest > 12 * 3600) fail("That's longer than twelve hours.");
  return { focus, rest, rounds };
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function words(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function timeOfDay(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const live = Deno.stdout.isTerminal();
const BELL = "\x07";

// Counts down one stretch. The remaining time is worked out from the clock
// on every tick rather than by counting ticks, so it never drifts.
async function countdown(label: string, seconds: number, round: string): Promise<void> {
  const end = Date.now() + seconds * 1000;
  if (!live) {
    const suffix = round ? ` (${round})` : "";
    console.log(`${label} for ${words(seconds)}, until ${timeOfDay(new Date(end))}${suffix}.`);
    await new Promise((r) => setTimeout(r, seconds * 1000));
    return;
  }
  const width = 24;
  for (;;) {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    const filled = Math.round(width * (1 - left / seconds));
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    write(`\r  ${label.padEnd(5)}  ${clock(left).padStart(7)}  ${bar}${round ? "  " + round : ""}\x1b[K`);
    if (left === 0) break;
    await new Promise((r) => setTimeout(r, end - Date.now() - (left - 1) * 1000));
  }
  write("\n");
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: pomo, pomo 25, pomo 25 5, pomo 25 5 x4");
  Deno.exit(1);
}

async function main(args: string[]): Promise<void> {
  const plan = parsePlan(args);
  for (let n = 1; n <= plan.rounds; n++) {
    const round = plan.rounds > 1 ? `round ${n} of ${plan.rounds}` : "";
    await countdown("Focus", plan.focus, round);
    // A break after the final round only makes sense for a single round.
    if (plan.rest && (n < plan.rounds || plan.rounds === 1)) {
      console.log(`${BELL}  Time for a break: ${words(plan.rest)}.`);
      await countdown("Break", plan.rest, round);
      if (n < plan.rounds) console.log(`${BELL}  Back to it.`);
    }
  }
  const total = plan.focus * plan.rounds;
  const summary = plan.rounds > 1 ? `${plan.rounds} rounds, ${words(total)} of focus` : words(total);
  console.log(`${BELL}  Done at ${timeOfDay(new Date())}: ${summary}.`);
}

if (import.meta.main) {
  await main(Deno.args);
}
