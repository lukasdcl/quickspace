// summary: Pong against the computer, first to seven
//
// Usage:
//   quick pong           up and down arrows (or W and S) move your paddle
//   quick pong hard      a quicker opponent
//
// You are on the left. P pauses and Q quits. Terminals don't report when a
// key is let go, so the paddle moves a step for each press; holding a key
// down repeats it.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const TARGET = 7;

type Key = "up" | "down" | "pause" | "quit" | "other";

function decode(bytes: Uint8Array): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b && bytes[i + 1] === 0x5b) {
      const c = bytes[i + 2];
      i += 2;
      keys.push(c === 0x41 ? "up" : c === 0x42 ? "down" : "other");
      continue;
    }
    const ch = String.fromCharCode(b).toLowerCase();
    if (b === 3 || ch === "q" || b === 0x1b) keys.push("quit");
    else if (ch === "w" || ch === "k") keys.push("up");
    else if (ch === "s" || ch === "j") keys.push("down");
    else if (ch === "p" || ch === " ") keys.push("pause");
    else keys.push("other");
  }
  return keys;
}

function restore(): void {
  try {
    Deno.stdin.setRaw(false);
  } catch {
    // stdin already closed
  }
  write("\x1b[0m\x1b[?25h\x1b[?1049l");
}

async function main(args: string[]): Promise<void> {
  if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
    console.error("Pong needs a terminal to play in.");
    Deno.exit(1);
  }
  const hard = args.join(" ").toLowerCase().includes("hard");
  const size = Deno.consoleSize();
  const W = Math.min(70, size.columns - 2), H = Math.min(22, size.rows - 4);
  if (W < 30 || H < 10) {
    console.error("Make the terminal window a bit bigger and try again.");
    Deno.exit(1);
  }
  const PADDLE = 4;
  let you = H / 2 - PADDLE / 2, them = you;
  let ball = { x: W / 2, y: H / 2, dx: 1, dy: 0.5 };
  const score = [0, 0];
  let paused = false, quit = false;
  const serve = (towards: number) => {
    const buf = new Uint8Array(1);
    crypto.getRandomValues(buf);
    ball = { x: W / 2, y: H / 2, dx: towards * 0.9, dy: (buf[0] / 255 - 0.5) * 1.2 };
  };
  serve(1);

  Deno.stdin.setRaw(true);
  write("\x1b[?1049h\x1b[?25l\x1b[2J");
  const pending: Key[] = [];
  const reader = Deno.stdin.readable.getReader();
  (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending.push(...decode(value));
    }
  })();

  const draw = (message = "") => {
    const rows: string[][] = Array.from({ length: H }, () => Array(W).fill(" "));
    for (let y = 0; y < H; y += 2) rows[y][Math.floor(W / 2)] = "┊";
    for (let i = 0; i < PADDLE; i++) {
      const a = Math.round(you) + i, b = Math.round(them) + i;
      if (a >= 0 && a < H) rows[a][1] = "█";
      if (b >= 0 && b < H) rows[b][W - 2] = "█";
    }
    const bx = Math.round(ball.x), by = Math.round(ball.y);
    if (by >= 0 && by < H && bx >= 0 && bx < W) rows[by][bx] = "●";
    let out = "\x1b[H" + `  You ${score[0]}`.padEnd(W / 2) + `Computer ${score[1]}`.padStart(W / 2 - 1) + "\x1b[K\r\n";
    out += "┌" + "─".repeat(W) + "┐\r\n";
    for (const r of rows) out += "│" + r.join("") + "│\r\n";
    out += "└" + "─".repeat(W) + "┘\r\n";
    out += (message || (paused ? "  Paused" : "  ↑↓ or W/S to move, P to pause, Q to quit")) + "\x1b[K";
    write(out);
  };

  try {
    let winner = "";
    while (!quit && !winner) {
      while (pending.length) {
        const k = pending.shift()!;
        if (k === "quit") quit = true;
        else if (k === "pause") paused = !paused;
        else if (!paused && k === "up") you = Math.max(0, you - 1.5);
        else if (!paused && k === "down") you = Math.min(H - PADDLE, you + 1.5);
      }
      if (quit) break;
      if (!paused) {
        // The computer follows the ball at a capped speed, so a fast or
        // steep return can get past it.
        const aim = ball.y - PADDLE / 2 + 0.5;
        const reach = hard ? 0.55 : 0.38;
        them += Math.max(-reach, Math.min(reach, aim - them));
        them = Math.max(0, Math.min(H - PADDLE, them));

        ball.x += ball.dx;
        ball.y += ball.dy;
        if (ball.y < 0) {
          ball.y = -ball.y;
          ball.dy = -ball.dy;
        }
        if (ball.y > H - 1) {
          ball.y = 2 * (H - 1) - ball.y;
          ball.dy = -ball.dy;
        }
        // Where the ball meets the paddle sets the angle it leaves at.
        const hit = (top: number) => ball.y >= top - 0.5 && ball.y <= top + PADDLE - 0.5;
        if (ball.dx < 0 && ball.x <= 2 && ball.x > 0.5 && hit(you)) {
          ball.x = 2;
          ball.dx = Math.min(2, -ball.dx * 1.05);
          ball.dy = (ball.y - (you + PADDLE / 2 - 0.5)) * 0.5;
        } else if (ball.dx > 0 && ball.x >= W - 3 && ball.x < W - 1.5 && hit(them)) {
          ball.x = W - 3;
          ball.dx = Math.max(-2, -ball.dx * 1.05);
          ball.dy = (ball.y - (them + PADDLE / 2 - 0.5)) * 0.5;
        }
        if (ball.x < 0 || ball.x > W - 1) {
          const toYou = ball.x > W - 1;
          score[toYou ? 0 : 1]++;
          if (score[0] === TARGET) winner = "You win";
          else if (score[1] === TARGET) winner = "The computer wins";
          draw(winner ? "" : toYou ? "  Point to you" : "  Point to the computer");
          await new Promise((r) => setTimeout(r, 900));
          serve(toYou ? -1 : 1);
        }
      }
      draw();
      await new Promise((r) => setTimeout(r, 33));
    }
    if (winner) {
      draw(`  ${winner}, ${Math.max(...score)} to ${Math.min(...score)}. Press any key.`);
      pending.length = 0;
      while (pending.length === 0) await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    restore();
  }
  console.log(`You ${score[0]}, computer ${score[1]}.`);
  Deno.exit(0);
}

if (import.meta.main) {
  await main(Deno.args);
}
