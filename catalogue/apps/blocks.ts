// summary: A falling blocks game: fit the pieces together to clear lines
//
// Usage:
//   quick blocks
//
// Left and right arrows move, up rotates, down drops faster, space drops all
// the way, P pauses and Q quits. WASD work too. Clearing lines scores more
// the more you clear at once, and the pieces speed up every ten lines.

const encoder = new TextEncoder();
const write = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
const W = 10, H = 20;

type Key = "left" | "right" | "rotate" | "down" | "drop" | "pause" | "quit" | "other";

function decode(bytes: Uint8Array): Key[] {
  const keys: Key[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x1b && bytes[i + 1] === 0x5b) {
      const c = bytes[i + 2];
      i += 2;
      keys.push(c === 0x41 ? "rotate" : c === 0x42 ? "down" : c === 0x43 ? "right" : c === 0x44 ? "left" : "other");
      continue;
    }
    const ch = String.fromCharCode(b).toLowerCase();
    if (b === 3 || ch === "q" || b === 0x1b) keys.push("quit");
    else if (ch === "a" || ch === "h") keys.push("left");
    else if (ch === "d" || ch === "l") keys.push("right");
    else if (ch === "w" || ch === "k" || ch === "x") keys.push("rotate");
    else if (ch === "s" || ch === "j") keys.push("down");
    else if (ch === " ") keys.push("drop");
    else if (ch === "p") keys.push("pause");
    else keys.push("other");
  }
  return keys;
}

// The seven pieces as cells in a 4x4 box, with their colours.
const PIECES: Array<{ cells: number[][]; colour: number }> = [
  { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], colour: 36 }, // I
  { cells: [[1, 0], [2, 0], [1, 1], [2, 1]], colour: 33 }, // O
  { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], colour: 35 }, // T
  { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], colour: 32 }, // S
  { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], colour: 31 }, // Z
  { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], colour: 34 }, // J
  { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], colour: 37 }, // L
];

interface Falling {
  cells: number[][];
  colour: number;
  x: number;
  y: number;
}

function randomInt(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Pieces come in shuffled sets of seven, so no piece is ever long overdue.
const bag: number[] = [];
function nextPiece(): Falling {
  if (bag.length === 0) {
    const set = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) {
      const j = randomInt(i + 1);
      [set[i], set[j]] = [set[j], set[i]];
    }
    bag.push(...set);
  }
  const p = PIECES[bag.pop()!];
  return { cells: p.cells.map((c) => [...c]), colour: p.colour, x: 3, y: -1 };
}

function rotate(cells: number[][], square: boolean): number[][] {
  if (square) return cells;
  const size = Math.max(...cells.flat()) >= 3 ? 4 : 3;
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

function restore(): void {
  try {
    Deno.stdin.setRaw(false);
  } catch {
    // stdin already closed
  }
  write("\x1b[0m\x1b[?25h\x1b[?1049l");
}

async function main(): Promise<void> {
  if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
    console.error("Blocks needs a terminal to play in.");
    Deno.exit(1);
  }
  const { columns, rows } = Deno.consoleSize();
  if (columns < 40 || rows < H + 4) {
    console.error(`Make the terminal at least 40 wide and ${H + 4} tall, then try again.`);
    Deno.exit(1);
  }
  const board: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  let piece = nextPiece(), upcoming = nextPiece();
  let score = 0, lines = 0, paused = false, over = false, quit = false;

  const fits = (p: Falling, cells = p.cells, dx = 0, dy = 0) =>
    cells.every(([cx, cy]) => {
      const x = p.x + cx + dx, y = p.y + cy + dy;
      return x >= 0 && x < W && y < H && (y < 0 || board[y][x] === 0);
    });

  const lock = () => {
    for (const [cx, cy] of piece.cells) {
      const y = piece.y + cy;
      if (y < 0) {
        over = true;
        return;
      }
      board[y][piece.x + cx] = piece.colour;
    }
    let cleared = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (board[y].every((c) => c)) {
        board.splice(y, 1);
        board.unshift(Array(W).fill(0));
        cleared++;
        y++;
      }
    }
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * (Math.floor(lines / 10) + 1);
    piece = upcoming;
    upcoming = nextPiece();
    if (!fits(piece)) over = true;
  };

  const draw = () => {
    const level = Math.floor(lines / 10) + 1;
    const cell = (c: number) => (c ? `\x1b[${c}m██\x1b[0m` : " ·");
    let out = "\x1b[H╔" + "══".repeat(W) + "╗\x1b[K\r\n";
    const side = [
      `Score ${score}`, `Lines ${lines}`, `Level ${level}`, "", "Next",
      ...[0, 1].map((r) => [0, 1, 2, 3].map((c) => upcoming.cells.some(([x, y]) => x === c && y === r) ? cell(upcoming.colour) : "  ").join("")),
      "", paused ? "Paused" : "", over ? "Game over" : "", over ? "Press any key" : "",
    ];
    for (let y = 0; y < H; y++) {
      let line = "║";
      for (let x = 0; x < W; x++) {
        const mine = piece.cells.some(([cx, cy]) => piece.x + cx === x && piece.y + cy === y);
        line += mine && !over ? cell(piece.colour) : cell(board[y][x]);
      }
      out += `${line}║  ${side[y] ?? ""}\x1b[K\r\n`;
    }
    out += "╚" + "══".repeat(W) + "╝\r\n";
    out += "←→ move  ↑ rotate  ↓ faster  space drop  P pause  Q quit\x1b[K";
    write(out);
  };

  Deno.stdin.setRaw(true);
  write("\x1b[?1049h\x1b[?25l\x1b[2J");
  const pending: Key[] = [];
  let wake: () => void = () => {};
  const reader = Deno.stdin.readable.getReader();
  (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending.push(...decode(value));
      wake();
    }
  })();

  try {
    let nextFall = Date.now();
    while (!over && !quit) {
      while (pending.length) {
        const k = pending.shift()!;
        if (k === "quit") quit = true;
        else if (k === "pause") paused = !paused;
        else if (paused) continue;
        else if (k === "left" && fits(piece, piece.cells, -1)) piece.x--;
        else if (k === "right" && fits(piece, piece.cells, 1)) piece.x++;
        else if (k === "rotate") {
          const r = rotate(piece.cells, piece.colour === 33);
          // Nudge away from a wall if the turn doesn't fit where it is.
          for (const dx of [0, -1, 1, -2, 2]) {
            if (fits(piece, r, dx)) {
              piece.cells = r;
              piece.x += dx;
              break;
            }
          }
        } else if (k === "down") {
          if (fits(piece, piece.cells, 0, 1)) piece.y++;
          nextFall = Date.now() + 400;
        } else if (k === "drop") {
          while (fits(piece, piece.cells, 0, 1)) {
            piece.y++;
            score += 2;
          }
          lock();
          nextFall = Date.now();
        }
      }
      if (quit || over) break;
      if (!paused && Date.now() >= nextFall) {
        if (fits(piece, piece.cells, 0, 1)) piece.y++;
        else lock();
        const level = Math.floor(lines / 10);
        nextFall = Date.now() + Math.max(80, 800 - level * 70);
      }
      draw();
      await new Promise<void>((r) => {
        wake = r;
        setTimeout(r, Math.max(10, Math.min(100, nextFall - Date.now())));
      });
    }
    if (over) {
      draw();
      pending.length = 0;
      while (pending.length === 0) await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    restore();
  }
  console.log(`Score ${score}, ${lines} line${lines === 1 ? "" : "s"}.`);
  Deno.exit(0);
}

if (import.meta.main) {
  await main();
}
