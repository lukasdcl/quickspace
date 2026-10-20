// summary: Toss a coin, or a lot of coins
//
// Usage:
//   quick flip          heads or tails
//   quick flip 10       ten tosses and the tally
//   quick flip 1000     enough to watch it even out

function randomBit(): number {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 1;
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: flip, flip 10");
  Deno.exit(1);
}

function main(args: string[]): void {
  const words = args.join(" ").toLowerCase().split(/\s+/).filter((w) => w && !["a", "coin", "coins", "times", "x"].includes(w));
  if (words.length > 1) fail("Give at most one number.");
  const n = words.length ? Number(words[0].replace(/^x/, "")) : 1;
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) fail("Pick a number of tosses from 1 to 1,000,000.");

  if (n === 1) {
    console.log(randomBit() ? "Heads" : "Tails");
    return;
  }
  let heads = 0;
  const shown: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = randomBit();
    heads += h;
    if (i < 30) shown.push(h ? "H" : "T");
  }
  const tails = n - heads;
  const pct = (x: number) => `${((100 * x) / n).toFixed(n >= 1000 ? 1 : 0)}%`;
  console.log(shown.join(" ") + (n > 30 ? " ..." : ""));
  console.log(`Heads ${heads.toLocaleString("en-GB")} (${pct(heads)}), tails ${tails.toLocaleString("en-GB")} (${pct(tails)})`);
}

if (import.meta.main) {
  main(Deno.args);
}
