// summary: Random character names, British by default
//
// Usage:
//   quick names               ten names
//   quick names 20
//   quick names female 5      or women, girls, f
//   quick names male          or men, boys, m
//   quick names old           names more common before about 1960
//
// First names and surnames are picked independently, so the mix is
// plausible rather than tied to any real person.

const FEMALE = [
  "Alice", "Amelia", "Anna", "Beth", "Caitlin", "Charlotte", "Chloe", "Claire",
  "Daisy", "Eleanor", "Ella", "Emily", "Erin", "Eve", "Freya", "Georgia",
  "Grace", "Hannah", "Harriet", "Holly", "Imogen", "Isla", "Jade", "Jess",
  "Kate", "Laura", "Leah", "Lily", "Lucy", "Maisie", "Megan", "Mia", "Molly",
  "Naomi", "Nina", "Olivia", "Phoebe", "Poppy", "Priya", "Rachel", "Rosie",
  "Ruby", "Sarah", "Sophie", "Tara", "Zara", "Aisha", "Niamh", "Siobhan", "Fiona",
];
const MALE = [
  "Adam", "Alfie", "Ben", "Callum", "Charlie", "Connor", "Dan", "David",
  "Dylan", "Ed", "Ethan", "Finn", "Freddie", "George", "Harry", "Henry",
  "Isaac", "Jack", "Jacob", "Jake", "James", "Joe", "Josh", "Kieran", "Leo",
  "Liam", "Luke", "Matt", "Max", "Nathan", "Noah", "Ollie", "Owen", "Reece",
  "Rhys", "Rory", "Ryan", "Sam", "Scott", "Theo", "Tom", "Will", "Zach",
  "Arjun", "Hamza", "Kwame", "Euan", "Gareth", "Declan", "Ross",
];
const FEMALE_OLD = [
  "Agnes", "Audrey", "Barbara", "Beryl", "Brenda", "Doreen", "Doris", "Edith",
  "Elsie", "Enid", "Ethel", "Gladys", "Hilda", "Irene", "Ivy", "Joan", "Joyce",
  "Mabel", "Margaret", "Marjorie", "Maud", "Mavis", "Muriel", "Nora", "Pamela",
  "Peggy", "Phyllis", "Rita", "Shirley", "Sylvia", "Violet", "Winifred",
];
const MALE_OLD = [
  "Albert", "Alfred", "Arthur", "Bernard", "Cecil", "Cyril", "Dennis", "Derek",
  "Donald", "Douglas", "Eric", "Ernest", "Frank", "Geoffrey", "Gordon",
  "Harold", "Herbert", "Horace", "Kenneth", "Leonard", "Maurice", "Norman",
  "Percy", "Ralph", "Reginald", "Roy", "Sidney", "Stanley", "Walter", "Wilfred",
];
const SURNAMES = [
  "Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies",
  "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts",
  "Green", "Hall", "Wood", "Jackson", "Clarke", "Patel", "Khan", "Lewis",
  "Harrison", "Baker", "Turner", "Hill", "Cooper", "Ward", "Morris", "Moore",
  "Clark", "Lee", "King", "Bell", "Harris", "Morgan", "Hughes", "Edwards",
  "Mitchell", "Kelly", "Price", "Marshall", "Fletcher", "Chapman", "Pearce",
  "Hartley", "Fenwick", "Ashdown", "Bramley", "Crane", "Dempsey", "Ellison",
  "Fairbairn", "Gilchrist", "Holloway", "Ingram", "Jessop", "Kershaw",
  "Lockwood", "Mayhew", "Nightingale", "Oakley", "Pembroke", "Quinn",
  "Ramsbottom", "Sutcliffe", "Thornton", "Underwood", "Vickers", "Whitlock",
  "Yardley", "Okafor", "Nowak", "Murphy", "Campbell", "MacLeod", "Singh",
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

function fail(message: string): never {
  console.error(message);
  console.error("Try: names, names 20, names female 5, names old");
  Deno.exit(1);
}

function main(args: string[]): void {
  let count = 10;
  let sex: "female" | "male" | null = null;
  let old = false;
  for (const w of args.join(" ").toLowerCase().split(/\s+/).filter(Boolean)) {
    if (/^\d+$/.test(w)) count = Number(w);
    else if (["female", "women", "woman", "girls", "girl", "f"].includes(w)) sex = "female";
    else if (["male", "men", "man", "boys", "boy", "m"].includes(w)) sex = "male";
    else if (["old", "older", "vintage", "classic"].includes(w)) old = true;
    else if (w !== "names" && w !== "name") fail(`Not sure what '${w}' means here.`);
  }
  if (count < 1 || count > 200) fail("Pick from 1 to 200 names.");

  const seen = new Set<string>();
  for (let i = 0, tries = 0; i < count && tries < count * 50; tries++) {
    const s = sex ?? (randomInt(2) ? "female" : "male");
    const first = s === "female" ? choose(old ? FEMALE_OLD : FEMALE) : choose(old ? MALE_OLD : MALE);
    const name = `${first} ${choose(SURNAMES)}`;
    if (seen.has(name)) continue;
    seen.add(name);
    console.log(name);
    i++;
  }
}

if (import.meta.main) {
  main(Deno.args);
}
