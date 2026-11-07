// summary: Builds a yt-dlp download command from plain-English choices
//
// Usage:
//   quick yt                          asks for the link, what to keep and the quality
//   quick yt audio only               asks only what's left
//   quick youtube audio max           YouTube's original audio, no conversion
//   quick yt 720p no sponsors
//   quick yt video only 4k
//   quick yt from 1:30 to 2:45        just that part of the video
//   quick yt last 30s
//   quick yt first 10 videos          the first ten in a playlist
//   quick yt mp3 subs ~/Music "https://youtu.be/..."
//   quick yt "https://youtu.be/..." imovie    a file iMovie can open, at the best quality it takes
//   quick yt audio --sub-langs fr     anything from the first option on goes to yt-dlp as typed
//
// Words can come in any order and in any case. The link, what to keep and
// the quality are asked if not given; the command is then shown with a menu
// of further options such as clips, subtitles and other formats. With no
// terminal to ask on, the defaults are used and only the command is printed,
// so `quick yt mp3 | pbcopy` works. Apps can't run other programs, so this prints the command for you to
// run rather than running it. Put a typed link in quotes, since most shells
// treat the ? and & in it specially, or paste it when asked.

const HELP = `Examples:
  quick yt                      answer a few questions
  quick yt audio only           MP3 unless you say otherwise
  quick yt audio max            YouTube's original audio, no conversion
  quick yt video only 4k
  quick yt 720p no sponsors subs
  quick yt from 1:30 to 2:45    or: first 30s, last 2m, clip 1:30 2:45
  quick yt playlist first 10    or: items 5-8, just this video
  quick yt mp3 chapters ~/Music
  quick yt signed in safari     for age-restricted or members-only videos
  quick yt limit 2m             cap the download speed at 2 MB/s
  quick yt imovie               or: final cut, davinci, davinci studio, premiere

Qualities: max, small, 4k, 1440p, 1080p, 720p, 480p, 360p
Formats:   mp4, mkv, mov, mp3, m4a, opus, flac, wav, alac
Anything from the first --option on is passed to yt-dlp unchanged.`;

type Mode = "both" | "audio" | "video";

interface Request {
  mode?: Mode;
  max?: boolean;
  small?: boolean;
  height?: number;
  format?: string;
  // Seconds. A negative start counts back from the end.
  clip?: { start: number; end: number | null };
  wantClip?: boolean;
  subs?: boolean;
  sponsors?: boolean;
  chapters?: boolean;
  thumbnail?: boolean;
  signIn?: boolean;
  browser?: string;
  wantFolder?: boolean;
  folder?: string;
  playlist?: boolean;
  items?: string;
  limit?: string;
  editor?: Editor;
  studio?: boolean;
  containerAsked?: boolean;
  url?: string;
  extra: string[];
}

const VIDEO_FORMATS = ["mp4", "mkv", "mov"];
const AUDIO_FORMATS = ["mp3", "m4a", "opus", "flac", "wav", "alac"];
const BROWSERS = ["chrome", "firefox", "safari", "edge", "brave", "opera", "vivaldi", "chromium"];
type Editor = "imovie" | "finalcut" | "resolve" | "premiere";

// What each editor can open. YouTube only offers H.264 up to 1080p; above
// that it is VP9 or AV1, which none of these open reliably, so larger
// downloads are converted. Resolve differs by edition outside macOS: the free
// Windows version reads only 8-bit H.264, the free Linux version no H.264 or
// H.265 at all, and no Linux version reads AAC.
const EDITORS: Record<Editor, { name: string; maxHeight?: number }> = {
  imovie: { name: "iMovie", maxHeight: 2160 },
  finalcut: { name: "Final Cut Pro" },
  resolve: { name: "DaVinci Resolve" },
  premiere: { name: "Premiere Pro" },
};

const HEIGHTS: Record<string, number> = {
  "8k": 4320, "4k": 2160, uhd: 2160, "2k": 1440, qhd: 1440, fhd: 1080, hd: 720, sd: 480,
};
const FILLER = new Set([
  "a", "an", "and", "the", "with", "in", "at", "of", "for", "as", "to", "from", "on", "into",
  "please", "download", "get", "grab", "save", "rip", "want", "i", "me", "my", "it", "this",
  "that", "just", "only", "quality", "version", "file", "files", "format", "res", "resolution",
  "yt", "youtube", "version", "copy", "good", "high", "best-quality",
]);

// ---------------------------------------------------------------------------
// Understanding typed words

interface Time {
  seconds: number;
  // Written with a colon or a unit, so it can't be mistaken for a count or a
  // resolution.
  marked: boolean;
}

function parseTime(text: string): Time | null {
  const colon = text.match(/^(\d+):(\d{1,2}(?:\.\d+)?)(?::(\d{1,2}(?:\.\d+)?))?$/);
  if (colon) {
    const [a, b, c] = colon.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
    return { seconds: c === undefined ? a! * 60 + b! : a! * 3600 + b! * 60 + c, marked: true };
  }
  const units = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)(s?))?$/);
  if (units && (units[1] || units[2] || units[3])) {
    const [, h, m, s, sUnit] = units;
    // "1h30" means an hour and a half, "2m30" two and a half minutes.
    const restIsMinutes = h && !m && s && !sUnit;
    const seconds = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 +
      (restIsMinutes ? Number(s) * 60 : Number(s ?? 0));
    return { seconds, marked: Boolean(h || m || sUnit) };
  }
  return null;
}

const TIME = String.raw`\d[\d:.hms]*`;

function warn(message: string): void {
  console.error(message);
}

function fail(message: string): never {
  console.error(message);
  console.error("Try: quick yt help");
  Deno.exit(1);
}

function setMode(req: Request, mode: Mode): void {
  if (req.mode && req.mode !== mode) {
    const names = { both: "video with sound", audio: "audio only", video: "video only" };
    fail(`That asks for both ${names[req.mode]} and ${names[mode]}. Pick one.`);
  }
  req.mode = mode;
}

// Applies typed words to req, in any order. Words override earlier choices,
// and switching between video and audio drops the old quality and format.
function understand(text: string, req: Request): void {
  const before = { mode: req.mode, max: req.max, small: req.small, height: req.height, format: req.format, editor: req.editor };
  Object.assign(req, { mode: undefined, max: undefined, small: undefined, height: undefined, format: undefined, editor: undefined });
  parseWords(text, req);
  const editor = req.editor;
  const formatSaid = req.format !== undefined;
  req.editor = before.editor;
  const switched = before.mode !== undefined && req.mode !== undefined && req.mode !== before.mode;
  req.mode ??= before.mode;
  if (!switched && !qualityKnown(req)) Object.assign(req, { max: before.max, small: before.small, height: before.height, format: before.format });
  if (req.format && AUDIO_FORMATS.includes(req.format)) req.mode = "audio";
  if (req.mode === "audio" && req.format && VIDEO_FORMATS.includes(req.format)) req.format = undefined;
  if (req.mode !== "audio" && req.format && AUDIO_FORMATS.includes(req.format)) req.format = undefined;
  if (req.mode === "audio") req.height = undefined;
  if (editor) applyEditor(req, editor);
  else if (req.editor && (req.mode === "audio" || formatSaid)) req.editor = undefined;
}

const interactive = () => Deno.stdin.isTerminal() && Deno.stdout.isTerminal();

// Sets an editing preset. Choices that would stop the file opening in the
// editor are overridden, after asking when there is someone to ask.
function applyEditor(req: Request, editor: Editor): void {
  const { name, maxHeight } = EDITORS[editor];
  const conflicts: string[] = [];
  if (req.mode === "audio") conflicts.push("audio only");
  if (req.format) conflicts.push(req.format.toUpperCase());
  if (maxHeight && (req.height ?? 0) > maxHeight) conflicts.push(`${req.height}p, as ${name} goes up to ${maxHeight}p`);
  if (conflicts.length) {
    const list = conflicts.join(", ");
    if (interactive()) {
      if (/^n/i.test(mustAsk(`\nOverride your earlier choices (${list}) to work with ${name}? [Y/n]`))) return;
    } else warn(`Overriding ${list} so it works with ${name}.`);
  }
  if (req.mode === "audio") req.mode = "both";
  req.format = undefined;
  if (maxHeight && (req.height ?? 0) > maxHeight) req.height = maxHeight;
  req.editor = editor;
  if (editor === "resolve" && Deno.build.os !== "darwin" && req.studio === undefined && interactive()) {
    const i = choose("Which DaVinci Resolve? Studio opens more formats here, so it can use smaller, better files.", [
      "Free version",
      "Studio (paid)",
    ]);
    req.studio = i === 1;
  }
}

function chooseEditor(req: Request): void {
  const editors = Object.keys(EDITORS) as Editor[];
  const i = choose("Which editing software?", editors.map((e) => EDITORS[e].name));
  applyEditor(req, editors[i ?? 0]);
}

function parseWords(text: string, req: Request): void {
  // Links and folder paths keep their case, so they are taken out first.
  const kept: string[] = [];
  const raw = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < raw.length; i++) {
    const word = raw[i].replace(/^["']|["']$/g, "");
    if (/^--?[A-Za-z]/.test(word)) {
      req.extra.push(...raw.slice(i));
      break;
    }
    if (/^(https?:\/\/|www\.|(m\.|music\.)?youtube\.com\/|youtu\.be\/)/i.test(word)) req.url = word;
    else if (/^(~([\/\\]|$)|\.{1,2}[\/\\]|\/|[A-Za-z]:[\/\\])/.test(word)) req.folder = word;
    else kept.push(word);
  }

  let s = ` ${kept.join(" ").toLowerCase()} `;
  const take = (re: RegExp, fn: (...m: string[]) => boolean) => {
    s = s.replace(re, (...m) => (fn(...(m as string[])) ? " " : m[0]));
  };
  const setClip = (start: Time | null, end: Time | null) => {
    if (start && end && end.seconds <= start.seconds) fail("The clip has to end after it starts.");
    req.clip = { start: start?.seconds ?? 0, end: end?.seconds ?? null };
    return true;
  };

  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?)\b/g, "$1s")
    .replace(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/g, "$1m")
    .replace(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/g, "$1h");

  take(/\b(?:limit|max(?:imum)?\s+speed|speed(?:\s+limit)?)\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*([kmg])(?:b|bps|b\/s)?\b/g, (_, n, unit) => {
    req.limit = `${n}${unit.toUpperCase()}`;
    return true;
  });

  // Playlist items, before clip times so "items 1-5" isn't read as seconds.
  take(/\b(?:items?|videos?|episodes?|tracks?|songs?|numbers?)\s+(\d+)\s*(?:-|to)\s*(\d+)\b/g, (_, a, b) => {
    req.items = `${a}:${b}`;
    return true;
  });

  take(new RegExp(String.raw`\b(clip|cut|section|part|snippet|segment)\s+(${TIME})\s+(?:to\s+|-\s*)?(${TIME}|end)\b`, "g"), (_, __, a, b) => {
    const start = parseTime(a), end = b === "end" ? null : parseTime(b);
    return Boolean(start && (b === "end" || end)) && setClip(start, end);
  });
  take(new RegExp(String.raw`\b(from\s+)?(${TIME})\s*(?:-|\bto\b|\buntil\b|\btill\b|\bthrough\b)\s*(${TIME}|end)\b`, "g"), (_, from, a, b) => {
    const start = parseTime(a), end = b === "end" ? null : parseTime(b);
    if (!start || (b !== "end" && !end)) return false;
    if (!from && !start.marked && !end?.marked) return false;
    return setClip(start, end);
  });
  take(new RegExp(String.raw`\bfirst\s+(${TIME})\b`, "g"), (_, a) => {
    const t = parseTime(a);
    return Boolean(t?.marked) && setClip({ seconds: 0, marked: true }, t);
  });
  take(new RegExp(String.raw`\blast\s+(${TIME})\b`, "g"), (_, a) => {
    const t = parseTime(a);
    if (!t?.marked) return false;
    req.clip = { start: -t.seconds, end: null };
    return true;
  });
  take(new RegExp(String.raw`\b(?:from|starting\s+at|start\s+at|after)\s+(${TIME})\b`, "g"), (_, a) => {
    const t = parseTime(a);
    return Boolean(t) && setClip(t, null);
  });
  take(new RegExp(String.raw`\b(?:until|till|up\s+to|to)\s+(${TIME})\b`, "g"), (_, a) => {
    const t = parseTime(a);
    if (!t || (!t.marked && !/until|till/.test(_))) return false;
    return setClip(null, t);
  });

  take(/\b(?:first|latest|newest|top)\s+(\d+)\b(?:\s+(?:videos?|items?|episodes?|tracks?|songs?))?/g, (_, n) => {
    req.items = `:${n}`;
    return true;
  });
  take(/\b(?:last|oldest)\s+(\d+)\b(?:\s+(?:videos?|items?|episodes?|tracks?|songs?))?/g, (_, n) => {
    req.items = `-${n}:`;
    return true;
  });

  const phrases: Array<[RegExp, string]> = [
    [/\b(?:audio|sound|music)[\s-]*only\b|\bonly[\s-]+(?:the\s+)?(?:audio|sound|music)\b|\bjust\s+(?:the\s+)?(?:audio|sound|music)\b/g, "audioonly"],
    [/\b(?:video|picture)[\s-]*only\b|\bonly[\s-]+(?:the\s+)?(?:video|picture)\b|\bjust\s+(?:the\s+)?(?:video|picture)\b|\b(?:no|without)\s+(?:sound|audio)\b/g, "videoonly"],
    [/\b(?:video|picture)\s*(?:and|with|\+|&)\s*(?:audio|sound)\b|\b(?:audio|sound)\s*(?:and|with|\+|&)\s*video\b|\bwith\s+sound\b/g, "both"],
    [/\b(?:no|skip|without|remove|cut(?:\s+out)?)\s+(?:the\s+)?(?:sponsors?|sponsored|sponsorships?|ads|adverts?)(?:\s+(?:segments?|bits?|parts?))?\b/g, "nosponsors"],
    [/\bsplit(?:\s+(?:by|into|on))?\s+chapters?\b/g, "chapters"],
    [/\bfull[\s-]?hd\b/g, "1080"],
    [/\bultra[\s-]?hd\b/g, "2160"],
    [/\b(?:just\s+)?this\s+(?:one|video)(?:\s+only)?\b|\bno[\s-]?playlist\b|\bone\s+video\b/g, "single"],
    [/\b(?:whole|entire|full)\s+playlist\b|\ball\s+(?:of\s+them|videos)\b/g, "playlist"],
    [/\b(?:sign(?:ed)?|log(?:ged)?)[\s-]?in\b/g, "signin"],
    [/\bsave\s+(?:it\s+)?(?:to|in)\s+(?:a\s+)?folder\b/g, "folder"],
    [/\bcover\s+art\b/g, "thumbnail"],
    [/\bfinal[\s-]*cut(?:[\s-]*pro)?(?:[\s-]*x)?\b|\bfcpx?\b/g, "finalcut"],
    [/\b(?:davinci(?:[\s-]*resolve)?|resolve)[\s-]+(?:studio|pro|paid)\b/g, "resolve studio"],
    [/\b(?:davinci(?:[\s-]*resolve)?|resolve)\b/g, "resolve"],
    [/\b(?:adobe\s+)?premiere(?:[\s-]*pro)?\b|\bppro\b/g, "premiere"],
  ];
  for (const [re, word] of phrases) s = s.replace(re, ` ${word} `);

  let sawAudio = false, sawVideo = false;
  for (let word of s.split(/\s+/).filter(Boolean)) {
    word = word.replace(/[,;]+$/, "");
    const p = word.match(/^(\d+)p$/);
    if (p) word = p[1];
    if (word === "help" || word === "?") {
      console.log(HELP);
      Deno.exit(0);
    } else if (word === "audioonly") setMode(req, "audio");
    else if (word === "videoonly" || word === "silent" || word === "mute" || word === "muted") setMode(req, "video");
    else if (word === "both") setMode(req, "both");
    else if (["audio", "sound", "music", "song", "podcast"].includes(word)) sawAudio = true;
    else if (["video", "picture", "movie"].includes(word)) sawVideo = true;
    else if (["max", "maximum", "best", "highest", "top", "hq", "hi-res", "hires", "original"].includes(word)) req.max = true;
    else if (["small", "smaller", "smallest", "low", "lowest", "worst", "tiny", "compact"].includes(word)) req.small = true;
    else if (word in HEIGHTS) req.height = HEIGHTS[word];
    else if (/^\d+$/.test(word) && [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320].includes(Number(word))) req.height = Number(word);
    else if (VIDEO_FORMATS.includes(word) || AUDIO_FORMATS.includes(word) || word === "aac") req.format = word === "aac" ? "m4a" : word;
    else if (["subs", "sub", "subtitles", "subtitle", "subtitled", "captions", "caption", "cc", "transcript"].includes(word)) req.subs = true;
    else if (["nosponsors", "sponsorblock", "nosponsor"].includes(word)) req.sponsors = true;
    else if (["chapters", "chapter"].includes(word)) req.chapters = true;
    else if (["thumbnail", "thumb", "thumbnails", "artwork"].includes(word)) req.thumbnail = true;
    else if (["signin", "login", "cookies", "members", "age-restricted", "private"].includes(word)) req.signIn = true;
    else if (BROWSERS.includes(word)) req.browser = word;
    else if (word in EDITORS) req.editor = word as Editor;
    else if (word === "studio") req.studio = true;
    else if (word === "free") req.studio = false;
    else if (["clip", "cut", "section", "part", "snippet", "segment", "excerpt", "trim"].includes(word)) req.wantClip = true;
    else if (["folder", "directory", "dir"].includes(word)) req.wantFolder = true;
    else if (word === "single") req.playlist = false;
    else if (["playlist", "all", "everything", "channel"].includes(word)) req.playlist = true;
    else if (!FILLER.has(word)) warn(`Not sure what '${word}' means, so leaving it out.`);
  }
  if (!req.mode) {
    if (sawAudio && sawVideo) setMode(req, "both");
    else if (sawAudio) setMode(req, "audio");
    else if (sawVideo) setMode(req, "both");
  }

  if (req.format && AUDIO_FORMATS.includes(req.format)) {
    if (req.mode && req.mode !== "audio") fail(`${req.format.toUpperCase()} is an audio format, but that asks for video.`);
    req.mode = "audio";
  }
  if (req.format && VIDEO_FORMATS.includes(req.format) && req.mode === "audio") {
    fail(`${req.format.toUpperCase()} is a video format, but that asks for audio only.`);
  }
  if (req.mode === "audio" && req.height) warn("Resolution doesn't apply to audio, so leaving it out.");
  if (req.items) req.playlist = true;
}

// ---------------------------------------------------------------------------
// Asking

// Returns null if input ends (Ctrl-D).
function ask(question: string): string | null {
  const answer = prompt(question);
  return answer === null ? null : answer.trim();
}

function mustAsk(question: string): string {
  const answer = ask(question);
  if (answer === null) {
    console.log();
    Deno.exit(1);
  }
  return answer;
}

// Offers numbered options. The answer can also be typed in words, in which
// case settled(words) applies them and says whether they answered it.
function choose(question: string, options: string[], settled?: (words: string) => boolean): number | null {
  console.log(`\n${question}`);
  options.forEach((o, i) => console.log(`  ${i + 1}  ${o}`));
  for (;;) {
    const answer = mustAsk("Choose [1]:");
    if (answer === "") return 0;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
    if (settled?.(answer)) return null;
    console.log(`  Type a number from 1 to ${options.length}.`);
  }
}

function askTime(question: string): Time | null {
  for (;;) {
    const answer = mustAsk(question).toLowerCase().replace(/\s+/g, "");
    if (answer === "") return null;
    const t = parseTime(answer);
    if (t) return t;
    console.log("  Try something like 1:30, 90s or 1h2m.");
  }
}

const qualityKnown = (req: Request) =>
  Boolean(req.max || req.small || req.height !== undefined || req.format !== undefined || req.editor);

// Only what the command can't be built without: the link, what to keep and
// the quality. Everything else is offered once the command is on screen.
function askEssentials(req: Request): void {
  if (!req.url) {
    const url = mustAsk("Paste the link, or press Enter to add it later:").replace(/^["']|["']$/g, "");
    if (url) req.url = url;
  }

  if (!req.mode) {
    const i = choose("What do you want?", [
      "Video with sound",
      "Audio only",
      "Video only, no sound",
    ], (words) => (understand(words, req), req.mode !== undefined));
    if (i !== null) req.mode = (["both", "audio", "video"] as Mode[])[i];
  }

  if (!qualityKnown(req) && req.mode === "audio") {
    const i = choose("Which kind of audio file?", [
      "MP3, plays everywhere",
      "Maximum quality, YouTube's original (usually Opus), no conversion",
      "M4A (AAC), good for Apple Music and iPhone",
      "WAV, uncompressed, for editing software",
    ], (words) => (understand(words, req), qualityKnown(req)));
    if (i !== null) req.format = ["mp3", "best", "m4a", "wav"][i];
  } else if (!qualityKnown(req)) {
    const i = choose("What quality?", [
      "Best that plays everywhere: MP4, usually 1080p",
      "Maximum: up to 4K or more",
      "720p, smaller file",
      "480p, smallest file",
    ], (words) => (understand(words, req), qualityKnown(req)));
    if (i === 1) req.max = true;
    if (i === 2) req.height = 720;
    if (i === 3) req.height = 480;
  }

  if (req.url && req.playlist === undefined && /[?&]list=/.test(req.url) && /[?&]v=|youtu\.be\//.test(req.url)) {
    const i = choose("That link is a video in a playlist. Which do you want?", [
      "Just this video",
      "The whole playlist",
    ]);
    req.playlist = i === 1;
  }
  followUp(req);
}

// Asks the details of anything chosen without them, such as "clip" with no
// times.
function followUp(req: Request): void {
  const big = req.max || (req.height ?? 0) > 1080;
  if (req.mode !== "audio" && big && !req.format && !req.editor && !req.containerAsked) {
    req.containerAsked = true;
    const i = choose("Above 1080p, YouTube only has VP9 or AV1 video, not H.264. How should it be saved?", [
      "MP4, no conversion: plays in VLC, IINA, browsers, Windows and most TVs, but not QuickTime or most editors",
      "MKV, no conversion: the same picture, and keeps YouTube's Opus sound rather than AAC",
      "MOV, converted to HEVC so QuickTime and Apple apps open it, which is slower",
      "Converted to open in editing software (iMovie, Final Cut, DaVinci Resolve, Premiere Pro), which is slower",
    ]);
    if (i === 1) req.format = "mkv";
    else if (i === 2) req.format = "mov";
    else if (i === 3) chooseEditor(req);
    else req.format = "mp4";
  }

  if (req.wantClip && !req.clip) {
    const start = askTime("\nStart at (like 1:30, or Enter for the beginning):");
    const end = askTime("End at (like 2:45, or Enter for the end):");
    if (start || end) {
      if (start && end && end.seconds <= start.seconds) fail("The clip has to end after it starts.");
      req.clip = { start: start?.seconds ?? 0, end: end?.seconds ?? null };
    }
  }
  req.wantClip = false;

  if (req.wantFolder && !req.folder) {
    const folder = mustAsk("\nWhich folder (like ~/Downloads)?").replace(/^["']|["']$/g, "");
    if (folder) req.folder = folder;
  }
  req.wantFolder = false;

  if (req.signIn && !req.browser) {
    const browsers = ["chrome", "firefox", ...(Deno.build.os === "darwin" ? ["safari"] : []), "edge", "brave"];
    const i = choose("Which browser are you signed in to YouTube on?", browsers.map((b) => b[0].toUpperCase() + b.slice(1)));
    req.browser = browsers[i ?? 0];
  }
}

function changeFormat(req: Request): void {
  req.editor = undefined;
  if (req.mode === "audio") {
    const formats = ["mp3", "best", "m4a", "wav", "flac", "opus"];
    const i = choose("Which audio format?", [
      "MP3, plays everywhere",
      "YouTube's original, no conversion",
      "M4A (AAC)",
      "WAV, uncompressed",
      "FLAC, lossless and compressed",
      "Opus, small and good quality",
    ]);
    req.format = formats[i ?? 0];
    req.max = req.format === "best";
    if (req.format === "best") req.format = undefined;
  } else {
    const i = choose("Which video format?", [
      "MP4 with H.264, plays everywhere (up to 1080p)",
      "MP4 at the highest quality (VP9 or AV1, which QuickTime and most editors can't open)",
      "MKV at the highest quality",
      "MOV at the highest quality, converted to HEVC so QuickTime opens it (slower)",
    ]);
    req.format = i === 2 ? "mkv" : i === 3 ? "mov" : "mp4";
    req.max = i !== 0;
  }
}

// Shows the command, then offers changes until Enter.
function refine(req: Request): void {
  const options: Array<[string, (r: Request) => void]> = [
    ["Trim to a clip", (r) => { r.clip = undefined; r.wantClip = true; }],
    ["Different file format", changeFormat],
    ["Make it open in editing software (iMovie, Final Cut, DaVinci Resolve, Premiere Pro)", chooseEditor],
    ["Subtitles", (r) => { r.subs = !r.subs; }],
    ["Cut out sponsor segments", (r) => { r.sponsors = !r.sponsors; }],
    ["Split into chapters", (r) => { r.chapters = !r.chapters; }],
    ["Save to a particular folder", (r) => { r.folder = undefined; r.wantFolder = true; }],
    ["Use your browser's sign-in (age-restricted or members-only)", (r) => { r.signIn = true; r.browser = undefined; }],
    ["Also save the thumbnail", (r) => { r.thumbnail = !r.thumbnail; }],
  ];
  for (;;) {
    console.log("\nMore options. Type a number, or describe a change (like 720p or from 1:30 to 2:45).");
    options.forEach(([label], i) => console.log(`  ${i + 1}  ${label}`));
    const answer = ask("Option, or Enter if you're done:");
    if (answer === null || answer === "") return;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) options[n - 1][1](req);
    else understand(answer, req);
    followUp(req);
    show(req, false);
  }
}

// ---------------------------------------------------------------------------
// Building the command

interface Part {
  flags: string[];
  why: string;
}

// Quotes anything a shell might expand or split. Commas count because
// PowerShell turns an unquoted list into an array.
function q(value: string): string {
  return /^[A-Za-z0-9._:\/=+@-]+$/.test(value) ? value : `"${value.replace(/"/g, "")}"`;
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  const s = Math.round((seconds % 60) * 1000) / 1000;
  const ss = (s < 10 ? "0" : "") + s;
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

type Target = Editor | "quicktime";

const pcm = " -c:a pcm_s16le";
const aac = " -c:a aac -b:a 256k";

// Recoding to .mov always runs, because no YouTube download arrives as .mov,
// whereas recoding to .mp4 would skip AV1 downloads that already are .mp4.
function editorParts(target: Target, mode: Mode, height: number | undefined, studio: boolean): Part[] {
  const name = target === "quicktime" ? "QuickTime and other Apple apps" : EDITORS[target].name;
  const cap = height ?? (target === "quicktime" ? undefined : EDITORS[target].maxHeight);
  const os = Deno.build.os;
  const sound = mode === "both";
  const resolve = target === "resolve" && os !== "darwin";
  const edition = resolve ? (studio ? "Resolve Studio" : "the free version of Resolve") : name;
  // No version of Resolve on Linux reads AAC, so the sound goes uncompressed.
  const audio = !sound ? "" : resolve && os === "linux" ? pcm : aac;
  const soundWhy = !sound ? "" : audio === pcm ? " with uncompressed sound, as Resolve on Linux can't read AAC" : " with AAC sound";
  const limit = cap ? [{ flags: ["-S", q(`res:${cap}`)], why: `the best picture at up to ${cap}p` }] : [];
  const convert = (video: string, why: string): Part => ({
    flags: ["--recode-video", "mov", "--ppa", q(`VideoConvertor:${video}${audio}`)],
    why,
  });

  if (resolve && os === "linux" && !studio) {
    return [...limit, convert(
      "-c:v dnxhd -profile:v dnxhr_hq -pix_fmt yuv422p",
      `converts to DNxHR${soundWhy} in a .mov, since the free Linux version of Resolve can't open H.264 or H.265. ` +
        "The files are very large, around 10 times the download; Studio avoids this",
    )];
  }

  if (cap && cap <= 1080) {
    const h264 = { flags: ["-S", q(`vcodec:h264,res:${cap},acodec:aac`)], why: `H.264 at up to ${cap}p, which ${edition} opens as it is` };
    if (audio === pcm) {
      return [h264, convert("-c:v copy", `puts it in a .mov${soundWhy}; the picture isn't converted, so this is quick`)];
    }
    const box = target === "quicktime" ? "mov" : "mp4";
    return [h264, sound
      ? { flags: ["--merge-output-format", box], why: `joins picture and sound into one ${box.toUpperCase()} file, without converting` }
      : { flags: ["--remux-video", box], why: `saves it as ${box.toUpperCase()}, without converting` }];
  }

  const h264 = resolve && !studio;
  const codec = h264 ? "H.264" : "HEVC (H.265)";
  const video = os === "darwin"
    ? `-c:v ${h264 ? "h264_videotoolbox" : "hevc_videotoolbox -tag:v hvc1"} -q:v 65`
    : h264 ? "-c:v libx264 -crf 16 -preset fast -pix_fmt yuv420p" : "-c:v libx265 -crf 18 -preset fast -tag:v hvc1";
  const speed = os === "darwin"
    ? "using the Mac's video hardware, so roughly as long as the video plays"
    : "in software, so expect it to take several times longer than the video plays";
  const reason = h264 ? ", the only kind the free version reads reliably" : "";
  return [...limit, convert(video, `converts to ${codec}${reason}${soundWhy} in a .mov file that ${edition} opens. ` +
    `This happens on your computer, ${speed}`)];
}

function build(req: Request): Part[] {
  const parts: Part[] = [];
  const mode = req.mode ?? "both";

  if (mode === "audio") {
    const format = req.format ?? (req.max ? "best" : "mp3");
    if (format === "best") {
      parts.push({ flags: ["-x"], why: "keeps just the sound, in YouTube's original format (usually Opus), with no conversion" });
    } else if (format === "m4a") {
      parts.push({
        flags: ["-f", q("ba[ext=m4a]/ba"), "-x", "--audio-format", "m4a"],
        why: "keeps just the sound as M4A, using YouTube's own AAC stream so it isn't re-encoded",
      });
    } else if (format === "mp3") {
      const level = req.small ? "5" : "0";
      parts.push({
        flags: ["-x", "--audio-format", "mp3", "--audio-quality", level],
        why: req.small
          ? "converts the sound to a smaller MP3 (about 130 kbps)"
          : "converts the sound to MP3 at its highest quality (about 245 kbps)",
      });
    } else if (format === "wav") {
      parts.push({
        flags: ["-x", "--audio-format", "wav"],
        why: "converts the sound to uncompressed WAV for editing software; bigger, but no better than the original",
      });
    } else {
      parts.push({ flags: ["-x", "--audio-format", format], why: `converts the sound to ${format.toUpperCase()}` });
    }
    if (format !== "wav") parts.push({ flags: ["--embed-thumbnail"], why: "adds the video's thumbnail as cover art" });
  } else {
    const height = req.height ?? (req.small ? 480 : undefined);
    if (mode === "video") parts.push({ flags: ["-f", "bv"], why: "the picture only, with no sound" });
    if (req.editor) parts.push(...editorParts(req.editor, mode, height, req.studio ?? false));
    else if (req.format === "mov") {
      parts.push(...editorParts("quicktime", mode, height ?? (req.max ? undefined : 1080), false));
    }
    else {
      const container = req.format ?? "mp4";
      const everywhere = !req.max && container === "mp4" && (height ?? 0) <= 1080;
      if (everywhere) {
        parts.push({
          flags: ["-S", q(`vcodec:h264,${height ? `res:${height}` : "res"},acodec:aac`)],
          why: `prefers H.264 video${mode === "both" ? " and AAC sound" : ""}, which play on almost anything, ` +
            (height ? `at up to ${height}p` : "usually at up to 1080p"),
        });
      } else if (container === "mp4") {
        parts.push({
          flags: ["-S", q(`res${height ? `:${height}` : ""},acodec:aac`)],
          why: `the best picture${height ? ` at up to ${height}p` : ""}${mode === "both" ? ", with AAC sound so it fits in MP4" : ""}`,
        });
      } else if (height) {
        parts.push({ flags: ["-S", q(`res:${height}`)], why: `the best quality at up to ${height}p` });
      }
      const caveat = container === "mp4" && !everywhere
        ? "; above 1080p the video is VP9 or AV1, which QuickTime and most editors can't open"
        : container === "mkv" ? ", which keeps YouTube's original sound as well" : "";
      parts.push(mode === "both"
        ? { flags: ["--merge-output-format", container], why: `joins picture and sound into one ${container.toUpperCase()} file, without converting${caveat}` }
        : { flags: ["--remux-video", container], why: `saves it as ${container.toUpperCase()}, without converting${caveat}` });
    }
    if (req.thumbnail) {
      parts.push({ flags: ["--write-thumbnail", "--convert-thumbnails", "jpg"], why: "also saves the thumbnail as a JPEG" });
    }
  }
  if (mode === "audio" && req.thumbnail) {
    parts.push({ flags: ["--write-thumbnail", "--convert-thumbnails", "jpg"], why: "also saves the thumbnail as a JPEG" });
  }
  parts.push({ flags: ["--embed-metadata"], why: "writes the title, channel and chapters into the file" });

  if (req.clip) {
    const { start, end } = req.clip;
    const range = start < 0 ? `*-${clock(-start)}-inf` : `*${clock(start)}-${end === null ? "inf" : clock(end)}`;
    const said = start < 0
      ? `only the last ${clock(-start)}`
      : end === null ? `only from ${clock(start)} to the end` : `only ${clock(start)} to ${clock(end)}`;
    parts.push({
      flags: ["--download-sections", q(range), "--force-keyframes-at-cuts"],
      why: `downloads ${said}, cut at exactly those times (slower, since the ends are re-encoded)`,
    });
  }
  if (req.subs) {
    const flags = ["--write-subs", "--write-auto-subs", "--sub-langs", q("en.*")];
    parts.push(mode === "audio"
      ? { flags: [...flags, "--convert-subs", "srt"], why: "saves English subtitles as an .srt text file; change en for another language" }
      : { flags: [...flags, "--embed-subs"], why: "adds English subtitles, including automatic ones; change en for another language" });
  }
  if (req.sponsors) {
    parts.push({
      flags: ["--sponsorblock-remove", q("sponsor,selfpromo,interaction")],
      why: "cuts out sponsor reads, self-promotion and subscribe reminders, as marked by SponsorBlock viewers",
    });
  }
  if (req.chapters) parts.push({ flags: ["--split-chapters"], why: "also saves each chapter as its own file" });
  if (req.browser) {
    parts.push({
      flags: ["--cookies-from-browser", req.browser],
      why: `uses your ${req.browser[0].toUpperCase() + req.browser.slice(1)} sign-in; close the browser if yt-dlp can't read it`,
    });
  }
  if (req.limit) parts.push({ flags: ["-r", req.limit], why: `limits the download to ${req.limit}B a second` });
  if (req.folder) parts.push({ flags: ["-P", q(req.folder)], why: `saves into ${req.folder}` });
  if (req.items) {
    const [a, b] = req.items.split(":");
    const said = !a ? `the first ${b}` : !b ? `the last ${a.slice(1)}` : `items ${a} to ${b}`;
    parts.push({ flags: ["-I", q(req.items)], why: `downloads ${said} in the playlist` });
  }
  const wholeList = req.playlist || (req.url !== undefined && /[?&]list=/.test(req.url) && !/[?&]v=|youtu\.be\//.test(req.url));
  if (wholeList) {
    parts.push({
      flags: ["--yes-playlist", "-o", q("%(playlist_title)s/%(playlist_index)s %(title)s.%(ext)s")],
      why: "gets the whole playlist into a folder named after it, numbered in order",
    });
  } else if (req.playlist === false) {
    parts.push({ flags: ["--no-playlist"], why: "just this video, not the playlist it's in" });
  }
  if (req.extra.length) parts.push({ flags: req.extra.map(q), why: "passed to yt-dlp as you typed it" });
  parts.push(req.url
    ? { flags: [`"${req.url.replace(/"/g, "")}"`], why: "the link" }
    : { flags: ['"LINK"'], why: "replace LINK with the video's address, keeping the quotes" });
  return parts;
}

function install(): string[] {
  switch (Deno.build.os) {
    case "darwin":
      return ["brew install yt-dlp ffmpeg", "brew upgrade yt-dlp"];
    case "windows":
      return ["winget install yt-dlp.yt-dlp\n  winget install Gyan.FFmpeg", "winget upgrade yt-dlp.yt-dlp"];
    default:
      return ["pipx install yt-dlp\n  and ffmpeg from your package manager, such as: sudo apt install ffmpeg", "pipx upgrade yt-dlp"];
  }
}

function show(req: Request, first: boolean): void {
  const parts = build(req);
  const command = ["yt-dlp", ...parts.flatMap((p) => p.flags)].join(" ");
  console.log(`\n  ${command}\n`);
  const width = Math.min(36, Math.max(...parts.map((p) => p.flags.join(" ").length)));
  for (const p of parts) {
    const flags = p.flags.join(" ");
    if (flags.length > width) console.log(`  ${flags}\n  ${" ".repeat(width)}  ${p.why}`);
    else console.log(`  ${flags.padEnd(width)}  ${p.why}`);
  }
  if (first) {
    const [get, upgrade] = install();
    console.log(`\nRun it in a terminal. It needs yt-dlp and ffmpeg. To install them:\n  ${get}`);
    console.log(`If downloads stop working, update yt-dlp first, since YouTube changes often:\n  ${upgrade}`);
  }
}

function main(args: string[]): void {
  const req: Request = { extra: [] };
  understand(args.join(" "), req);
  if (!(Deno.stdin.isTerminal() && Deno.stdout.isTerminal())) {
    console.log(["yt-dlp", ...build(req).flatMap((p) => p.flags)].join(" "));
    return;
  }
  askEssentials(req);
  show(req, true);
  refine(req);
}

if (import.meta.main) {
  main(Deno.args);
}
