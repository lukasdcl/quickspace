// summary: Ask a yes or no question and get an answer
//
// Usage:
//   quick 8ball will it rain tomorrow
//   quick 8ball                           asks for the question
//
// Half the answers lean yes, a quarter no and a quarter won't commit, which
// is about the balance people expect from a fortune-telling toy.

const YES = [
  "Yes.",
  "Without a doubt.",
  "All signs say yes.",
  "Very likely.",
  "I'd put money on it.",
  "Looks good from here.",
  "Yes, and sooner than you think.",
  "Go for it.",
];
const NO = [
  "No.",
  "Unlikely.",
  "I wouldn't count on it.",
  "The signs say no.",
];
const MAYBE = [
  "Ask again later.",
  "Too foggy to tell.",
  "Hard to say.",
  "Sleep on it.",
];

function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

function main(args: string[]): void {
  let question = args.join(" ").trim();
  if (!question && Deno.stdin.isTerminal()) question = (prompt("What's your question?") ?? "").trim();
  if (!question) {
    console.error("Ask it something.");
    console.error("Try: 8ball will it rain tomorrow");
    Deno.exit(1);
  }
  const all = [...YES, ...NO, ...MAYBE];
  console.log(all[randomInt(all.length)]);
}

if (import.meta.main) {
  main(Deno.args);
}
