// summary: A sand timer drawn in the terminal, for when a number is too abstract
//
// Usage:
//   quick hourglass           three minutes, like a kitchen egg timer
//   quick hourglass 10        ten minutes
//   quick hourglass 45s
//
// Good for children, or anyone, who find it easier to see time running out
// than to read it. The bell rings at the end. Ctrl-C stops it. With no
// terminal to draw in, it waits and then rings.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const BELL = "\x07";
const HALF = 7; // rows in each bulb
const GRAIN = "▓";

function parseDuration(text: string): number | null {
  const t = text.toLowerCase().replace(/\s+/g, "").replace(/minutes?|mins?/, "m").replace(/seconds?|secs?/, "s");
  if (t === "") return 180;
  const m = t.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)(m|s)?)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * (m[3] === "s" ? 1 : 60);
  return s > 0 ? Math.round(s) : null;
}

// Width of the glass's inside on each row, widest at the top and bottom.
const rowWidth = (r: number) => 2 * (HALF - r) - 1;
const CAPACITY = Array.from({ length: HALF }, (_, r) => rowWidth(r)).reduce((a, b) => a + b, 0);

// Draws the glass with `fraction` of the sand still in the top bulb. The top
// empties from its surface down, and the bottom fills as a heap from the
// bottom up, so it reads like a real sand glass.
export function frame(fraction: number, tick: number): string[] {
  const top = Math.round(CAPACITY * fraction);
  const bottom = CAPACITY - top;
  const lines = ["   ╔" + "═".repeat(2 * HALF + 1) + "╗"];

  let remaining = top;
  const topRows: number[] = [];
  for (let r = HALF - 1; r >= 0; r--) {
    const fill = Math.min(rowWidth(r), remaining);
    remaining -= fill;
    topRows[r] = fill;
  }
  for (let r = 0; r < HALF; r++) {
    const w = rowWidth(r), fill = topRows[r];
    const inner = " ".repeat(Math.floor((w - fill) / 2)) + GRAIN.repeat(fill) + " ".repeat(Math.ceil((w - fill) / 2));
    lines.push("   " + " ".repeat(r) + " \\" + inner + "/");
  }
  const falling = top > 0 && tick % 2 === 0 ? ":" : top > 0 ? "." : " ";
  lines.push("   " + " ".repeat(HALF) + " " + falling);

  remaining = bottom;
  const bottomRows: number[] = [];
  for (let r = 0; r < HALF; r++) {
    const fill = Math.min(rowWidth(r), remaining);
    remaining -= fill;
    bottomRows[r] = fill;
  }
  for (let i = HALF - 1; i >= 0; i--) {
    const w = rowWidth(i), fill = bottomRows[i];
    const inner = " ".repeat(Math.floor((w - fill) / 2)) + GRAIN.repeat(fill) + " ".repeat(Math.ceil((w - fill) / 2));
    lines.push("   " + " ".repeat(i) + " /" + inner + "\\");
  }
  lines.push("   ╚" + "═".repeat(2 * HALF + 1) + "╝");
  return lines;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function main(args: string[]): Promise<void> {
  const seconds = parseDuration(args.join(" "));
  if (seconds === null || seconds > 4 * 3600) {
    console.error(seconds === null ? "Couldn't read that as a length of time." : "Keep it under four hours.");
    console.error("Try: hourglass, hourglass 10, hourglass 45s");
    Deno.exit(1);
  }
  const end = Date.now() + seconds * 1000;
  if (!Deno.stdout.isTerminal()) {
    await new Promise((r) => setTimeout(r, seconds * 1000));
    console.log(`${BELL}Time's up.`);
    return;
  }
  write("\x1b[?25l");
  Deno.addSignalListener("SIGINT", () => {
    write("\x1b[?25h\n");
    Deno.exit(130);
  });
  let first = true;
  for (let tick = 0; ; tick++) {
    const left = Math.max(0, end - Date.now());
    const lines = frame(left / (seconds * 1000), tick);
    lines.push(`        ${clock(Math.ceil(left / 1000)).padStart(6)}`);
    if (!first) write(`\x1b[${lines.length}A`);
    first = false;
    write(lines.map((l) => l + "\x1b[K").join("\n") + "\n");
    if (left === 0) break;
    await new Promise((r) => setTimeout(r, Math.min(500, left)));
  }
  write("\x1b[?25h");
  console.log(`${BELL}   Time's up.`);
}

if (import.meta.main) {
  await main(Deno.args);
}
