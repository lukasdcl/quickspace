// summary: A plausible-ish excuse for being late or missing something
//
// Usage:
//   quick excuse           one excuse
//   quick excuse 3         three to choose from
//
// Each excuse is assembled from an opening, a cause and a closing line, so
// the same one rarely comes up twice.

const OPENINGS = [
  "So sorry,",
  "Really sorry about this,",
  "Apologies,",
  "You won't believe this, but",
  "Bit of a nightmare morning:",
  "Quick heads up:",
  "I feel terrible, but",
];
const CAUSES = [
  "the boiler's decided today is the day to give up",
  "there's a lorry jackknifed across the only road out",
  "the train has been held outside the station for forty minutes",
  "the dog has eaten something it shouldn't have and we're at the vet",
  "I've locked my keys in the car, with the car running",
  "a pipe's burst under the kitchen sink",
  "the cat has shut itself in the airing cupboard and won't come out",
  "my laptop chose this moment to install updates",
  "a delivery I have to sign for has a four-hour window starting now",
  "the neighbour's alarm has been going since six and I'm the keyholder",
  "the school has called and I need to collect a small, sick person",
  "the replacement bus service has replaced itself with nothing",
  "I've just realised I put the wrong time in my calendar",
  "the internet is down and I'm tethering off a phone with one bar",
  "my car's battery is flat and I'm waiting on a jump start",
];
const CLOSINGS = [
  "Can we push back an hour?",
  "I'll be there as soon as I can.",
  "Can we pick this up tomorrow?",
  "Go ahead without me and I'll catch up.",
  "Could we move to a call instead?",
  "I'll make it up to you.",
];

function randomInt(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

const choose = <T>(list: T[]): T => list[randomInt(list.length)];

function main(args: string[]): void {
  const word = args.join(" ").trim();
  const n = word === "" ? 1 : Number(word.replace(/^x/, ""));
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    console.error("Ask for from 1 to 10 excuses.");
    console.error("Try: excuse, excuse 3");
    Deno.exit(1);
  }
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let cause = choose(CAUSES);
    while (used.has(cause)) cause = choose(CAUSES);
    used.add(cause);
    console.log(`${choose(OPENINGS)} ${cause}. ${choose(CLOSINGS)}`);
  }
}

if (import.meta.main) {
  main(Deno.args);
}
