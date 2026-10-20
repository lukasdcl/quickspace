// summary: Count the words and characters in some text, with reading time
//
// Usage:
//   quick count the quick brown fox            counts the words given
//   pbpaste | quick count                      counts text piped in
//   quick count                                paste text, then Ctrl-D
//
// quick can't open files, so pipe them in: `quick count < notes.txt`.
// Reading time assumes 238 words a minute, the average for silent reading
// found in a 2019 review of 190 studies; speaking time assumes 150.

const READ_WPM = 238;
const SPEAK_WPM = 150;

function minutes(words: number, wpm: number): string {
  const secs = Math.round((words / wpm) * 60);
  if (secs < 60) return `${secs} sec`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return s >= 30 ? `${m + 1} min` : `${m} min`;
}

export function stats(text: string) {
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
  const chars = [...text.replace(/\r?\n$/, "")].length;
  const noSpaces = [...text.replace(/\s/g, "")].length;
  const lines = text === "" ? 0 : text.replace(/\r?\n$/, "").split(/\r?\n/).length;
  const sentences = text.match(/[^.!?]*[\p{L}\p{N}][^.!?]*[.!?]+/gu)?.length ?? 0;
  const paragraphs = text.split(/\r?\n\s*\r?\n/).filter((p) => p.trim()).length;
  return { words, chars, noSpaces, lines, sentences, paragraphs };
}

async function main(args: string[]): Promise<void> {
  let text: string;
  if (args.length) {
    text = args.join(" ");
  } else {
    if (Deno.stdin.isTerminal()) {
      const end = Deno.build.os === "windows" ? "Ctrl-Z then Enter" : "Ctrl-D";
      console.error(`Paste or type the text, then press ${end} on a new line.`);
    }
    text = await new Response(Deno.stdin.readable).text();
  }
  const s = stats(text);
  const n = (x: number) => x.toLocaleString("en-GB");
  console.log(`Words       ${n(s.words)}`);
  console.log(`Characters  ${n(s.chars)} (${n(s.noSpaces)} without spaces)`);
  if (s.lines > 1) console.log(`Lines       ${n(s.lines)}`);
  if (s.sentences > 1) console.log(`Sentences   ${n(s.sentences)}`);
  if (s.paragraphs > 1) console.log(`Paragraphs  ${n(s.paragraphs)}`);
  if (s.words >= 20) console.log(`Reading     about ${minutes(s.words, READ_WPM)}, or ${minutes(s.words, SPEAK_WPM)} out loud`);
}

if (import.meta.main) {
  await main(Deno.args);
}
