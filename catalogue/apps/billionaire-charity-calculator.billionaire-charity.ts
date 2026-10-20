// summary: Put a billionaire's donation in perspective against your own wealth
//
// Usage:
//   quick billionaire-calculator                     (asks interactively)
//   quick billionaire-calculator <donation> <their-net-worth> [your-net-worth]
//
// Amounts accept plain numbers, commas, a leading currency symbol and the
// suffixes k, m, bn and tn: "150m", "£220bn", "1,500,000".

const SUFFIXES: Record<string, number> = {
  "": 1,
  k: 1e3,
  m: 1e6,
  mn: 1e6,
  b: 1e9,
  bn: 1e9,
  t: 1e12,
  tn: 1e12,
};

export function parseAmount(input: string): number | null {
  const match = input
    .trim()
    .toLowerCase()
    .replace(/^[£$€]/, "")
    .replaceAll(",", "")
    .match(/^(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if (!match) return null;
  const multiplier = SUFFIXES[match[2]];
  if (multiplier === undefined) return null;
  const value = Number(match[1]) * multiplier;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatAmount(value: number): string {
  const units: Array<[number, string]> = [
    [1e12, " trillion"],
    [1e9, " billion"],
    [1e6, " million"],
  ];
  for (const [size, label] of units) {
    if (value >= size) return `${trim(value / size)}${label}`;
  }
  return value >= 100
    ? Math.round(value).toLocaleString("en-GB")
    : value.toFixed(2);
}

export function formatPercent(fraction: number): string {
  const percent = fraction * 100;
  if (percent >= 1) return `${trim(percent)}%`;
  // Keep two significant figures for very small percentages.
  return `${Number(percent.toPrecision(2))}%`;
}

function trim(value: number): string {
  return Number(value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)).toString();
}

function ask(question: string): number | null {
  for (;;) {
    const answer = prompt(question);
    if (answer === null) return null; // stdin closed or not interactive
    if (answer.trim() === "") return null;
    const value = parseAmount(answer);
    if (value !== null) return value;
    console.log("  Couldn't read that. Try something like 150m or 220bn.");
  }
}

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}

function main(args: string[]): void {
  let donation: number | null;
  let netWorth: number | null;
  let yourWorth: number | null = null;

  if (args.length > 0) {
    if (args.length < 2 || args.length > 3) {
      fail("Usage: billionaire-calculator <donation> <their-net-worth> [your-net-worth]");
    }
    [donation, netWorth] = [parseAmount(args[0]), parseAmount(args[1])];
    if (donation === null || netWorth === null) fail("Couldn't read those amounts.");
    if (args[2] !== undefined) {
      yourWorth = parseAmount(args[2]);
      if (yourWorth === null) fail(`Couldn't read '${args[2]}'.`);
    }
  } else {
    donation = ask("How much did they give?");
    if (donation === null) fail("No donation given.");
    netWorth = ask("What are they worth?");
    if (netWorth === null) fail("No net worth given.");
    yourWorth = ask("What are you worth? (press Enter to skip)");
  }

  const fraction = donation / netWorth;
  console.log();
  console.log(
    `A donation of ${formatAmount(donation)} is ${formatPercent(fraction)} ` +
      `of a ${formatAmount(netWorth)} fortune.`,
  );
  if (fraction > 1) {
    console.log("That's more than they're worth, so check the figures.");
  }
  if (yourWorth !== null) {
    console.log(
      `For someone worth ${formatAmount(yourWorth)}, that's like giving ` +
        `${formatAmount(yourWorth * fraction)}.`,
    );
  }
}

if (import.meta.main) {
  main(Deno.args);
}
