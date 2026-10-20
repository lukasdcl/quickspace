// summary: The snake game, played with the arrow keys
//
// Usage:
//   quick snake          arrow keys or WASD to steer, P to pause, Q to quit
//   quick snake fast
//
// Eat the food to grow. Hitting a wall or yourself ends the game. The board
// fits the terminal window, up to a comfortable maximum.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));

type Dir = "up" | "down" | "left" | "right";
type Key = Dir | "quit" | "pause" | "other";

function decode(bytes: Uint8Array): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b && bytes[i + 1] === 0x5b) {
      const c = bytes[i + 2];
      i += 2;
      keys.push(c === 0x41 ? "up" : c === 0x42 ? "down" : c === 0x43 ? "right" : c === 0x44 ? "left" : "other");
      continue;
    }
    const ch = String.fromCharCode(b).toLowerCase();
    if (b === 3 || ch === "q" || b === 0x1b) keys.push("quit");
    else if (ch === "w" || ch === "k") keys.push("up");
    else if (ch === "s" || ch === "j") keys.push("down");
    else if (ch === "a" || ch === "h") keys.push("left");
    else if (ch === "d" || ch === "l") keys.push("right");
    else if (ch === "p" || ch === " ") keys.push("pause");
    else keys.push("other");
  }
  return keys;
}

function randomInt(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Puts the terminal back however the game ends.
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
    console.error("Snake needs a terminal to play in.");
    Deno.exit(1);
  }
  const fast = args.join(" ").toLowerCase().includes("fast");
  const { columns, rows } = Deno.consoleSize();
  // Each cell is two characters wide so the board looks square.
  const W = Math.max(10, Math.min(30, Math.floor((columns - 2) / 2)));
  const H = Math.max(8, Math.min(20, rows - 4));
  if (columns < 22 || rows < 12) {
    console.error("Make the terminal window a bit bigger and try again.");
    Deno.exit(1);
  }

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

  let snake = [{ x: Math.floor(W / 2), y: Math.floor(H / 2) }];
  let dir: Dir = "right";
  let food = { x: 0, y: 0 };
  const placeFood = () => {
    do food = { x: randomInt(W), y: randomInt(H) };
    while (snake.some((p) => p.x === food.x && p.y === food.y));
  };
  placeFood();
  let score = 0, paused = false, over = false, quit = false;
  const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

  const draw = () => {
    let out = "\x1b[H";
    out += `  Score ${score}${paused ? "   paused" : ""}`.padEnd(W * 2 + 2) + "\r\n";
    out += "╔" + "══".repeat(W) + "╗\r\n";
    for (let y = 0; y < H; y++) {
      let line = "║";
      for (let x = 0; x < W; x++) {
        const i = snake.findIndex((p) => p.x === x && p.y === y);
        if (i === 0) line += "\x1b[32m██\x1b[0m";
        else if (i > 0) line += "\x1b[32m▓▓\x1b[0m";
        else if (food.x === x && food.y === y) line += "\x1b[31m●\x1b[0m ";
        else line += "  ";
      }
      out += line + "║\r\n";
    }
    out += "╚" + "══".repeat(W) + "╝\r\n";
    out += over ? "  Game over. Press any key." : "  Arrows to steer, P to pause, Q to quit";
    write(out + "\x1b[K");
  };

  try {
    while (!over && !quit) {
      // Only the first turn per tick counts, and turning back on yourself is
      // ignored, so a quick double tap can't kill the snake.
      let turned = false;
      while (pending.length) {
        const k = pending.shift()!;
        if (k === "quit") quit = true;
        else if (k === "pause") paused = !paused;
        else if (k !== "other" && !turned && k !== opposite[dir] && !paused) {
          dir = k;
          turned = true;
        }
      }
      if (quit) break;
      if (!paused) {
        const head = { ...snake[0] };
        if (dir === "up") head.y--;
        if (dir === "down") head.y++;
        if (dir === "left") head.x--;
        if (dir === "right") head.x++;
        const eats = head.x === food.x && head.y === food.y;
        const body = eats ? snake : snake.slice(0, -1);
        if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H || body.some((p) => p.x === head.x && p.y === head.y)) {
          over = true;
        } else {
          snake = [head, ...body];
          if (eats) {
            score++;
            if (snake.length === W * H) over = true;
            else placeFood();
          }
        }
      }
      draw();
      // Speeds up a little as the snake grows.
      const base = fast ? 80 : 140;
      await new Promise((r) => setTimeout(r, Math.max(50, base - score * 2)));
    }
    if (over) {
      pending.length = 0;
      while (pending.length === 0) await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    restore();
  }
  console.log(`Score: ${score}`);
  Deno.exit(0);
}

if (import.meta.main) {
  await main(Deno.args);
}
