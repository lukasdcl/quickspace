// summary: Pick one of the words you give it at random
//
// Usage:
//   quick pick pizza curry tacos
//   quick pick "fish and chips" pasta     quotes keep several words together
//
// Every word after "pick" is an option, so nothing is treated as a
// command or a number of picks.

function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

function main(args: string[]): void {
  const options = args.map((a) => a.trim()).filter(Boolean);
  if (options.length === 0) {
    console.error("Give it something to choose from.");
    console.error("Try: pick pizza curry tacos");
    Deno.exit(1);
  }
  if (options.length === 1) {
    console.log(`${options[0]} (it was the only option)`);
    return;
  }
  console.log(options[randomInt(options.length)]);
}

if (import.meta.main) {
  main(Deno.args);
}
