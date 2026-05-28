// Client- and server-safe blocklist with fuzzy matching.

/** Shown when blocklist rejects user-entered caption text. */
export const BLOCKLIST_USER_MESSAGE = "Please use school-safe language.";

// Goal: catch obvious bypasses (l33t speak, spaces, repeated chars, accents)
// while keeping false-positives low. The OpenAI moderation API is the
// authoritative second layer for the cases this misses.

const LEET_MAP = {
  "0": "o",
  "1": "l",
  "!": "i",
  "|": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "+": "t",
  "(": "c",
  "[": "c",
  "{": "c",
};

// Common Cyrillic/Greek homoglyphs used to bypass Latin filters.
const HOMOGLYPH_MAP = {
  "\u0430": "a",
  "\u0435": "e",
  "\u043e": "o",
  "\u0440": "p",
  "\u0441": "c",
  "\u0443": "y",
  "\u0445": "x",
  "\u0456": "i",
  "\u04cf": "l",
  "\u03b1": "a",
  "\u03bf": "o",
};

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .map((c) => HOMOGLYPH_MAP[c] || LEET_MAP[c] || c)
    .join("");
}

// Split on whitespace, then strip ALL non-letters from each token. This way
// "f*ck this" produces ["fck", "this"] (so "fck" matches the blocklist),
// while "computadora" stays as a single token "computadora" without ever
// becoming "puta".
function tokensOf(input) {
  return normalize(input)
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter(Boolean);
}

// Strip all non-letters and collapse runs of repeated chars: "fuuuuck" -> "fuck".
function collapseOf(input) {
  return normalize(input)
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

// SUBSTRING_BLOCKED: matched as substring against the collapsed input
// ("fuuck", "f u c k", "f.u.c.k" all collapse to "fuck"). Only put words
// here that have very low risk of innocent substring collision — i.e. they
// don't naturally appear inside benign English/Spanish words.
const SUBSTRING_BLOCKED = [
  // Strong English profanity
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "motherfucking",
  "phuck",
  "fvck",
  "fxck",
  "sh1t",
  "shlt",
  "sht",
  "shyt",
  "shit",
  "shitty",
  "shithead",
  "bullshit",
  "horseshit",
  "bitch",
  "bitches",
  "biatch",
  "bitchass",
  "cunt",
  "asshole",
  "asshat",
  "assfuck",
  "dickhead",
  "douchebag",
  "wanker",
  // Slurs - racial/ethnic
  "nigger",
  "nigga",
  "chink",
  "kike",
  "wetback",
  "gook",
  "beaner",
  "raghead",
  "sandnigger",
  // Slurs - LGBTQ
  "faggot",
  "tranny",
  "shemale",
  // Slurs - ableist
  "retard",
  "retarded",
  "mongoloid",
  // Sexual / NSFW
  "porn",
  "porno",
  "pornhub",
  "pornography",
  "blowjob",
  "handjob",
  "rimjob",
  "cumshot",
  "cumslut",
  "deepthroat",
  "rapist",
  "raping",
  "molester",
  "masturbate",
  "masturbation",
  "masturbating",
  "boobs",
  "boobies",
  "titties",
  "nipples",
  "pussy",
  "clitoris",
  "ejaculate",
  "ejaculation",
  "pedophile",
  "pedophilia",
  "lolicon",
  "bestiality",
  // Drug references (educational context)
  "cocaine",
  "heroin",
  "methamphetamine",
  "crackhead",
  // Spanish profanity & slurs (high-confidence — unlikely substring collisions)
  "putamadre",
  "chinga",
  "chingar",
  "chingada",
  "chingado",
  "chinguen",
  "chingaderas",
  "pendejo",
  "pendeja",
  "vergota",
  "jodido",
  "jodida",
  "maricon",
  "maricones",
  "maricona",
  "conchudo",
  "conchuda",
  "conchasumadre",
  "mierda",
  "cabron",
  "cabrona",
  "gilipollas",
  "chupame",
  "chupala",
  "tetona",
  "culona",
];

// TOKEN_BLOCKED: matched only as whole-word tokens. Used for short or
// ambiguous terms that overlap with benign words (e.g. "ass" in "class",
// "puta" in "computadora", "anal" in "analyze").
const TOKEN_BLOCKED = [
  // Short English profanity
  "ass",
  "fag",
  "fck",
  "fuk",
  "tit",
  "tits",
  "kys",
  "twat",
  "bollocks",
  "douche",
  // Short slurs (still must be blocked as words)
  "spic",
  "spics",
  "chinks",
  "kikes",
  "gooks",
  "faggy",
  "trannies",
  "dyke",
  "dykes",
  "spaz",
  "spastic",
  // Sexual short forms
  "anal",
  "rape",
  "molest",
  "horny",
  "cock",
  "cocks",
  "dick",
  "dicks",
  "penis",
  "vagina",
  "pedo",
  "loli",
  "incest",
  "cumming",
  "suicide",
  "killyourself",
  "meth",
  "wtf",
  "stfu",
  "idiot",
  "moron",
  "dumbass",
  // Spanish short / collision-prone
  "puta",
  "puto",
  "putita",
  "putitas",
  "putas",
  "putos",
  "verga",
  "carajo",
  "carajos",
  "joder",
  "marica",
  "concha",
  "mierdas",
  "cabrones",
  "polla",
  "follar",
  "coger",
  "culero",
  "culera",
  "tetonas",
  "pendejos",
  "pendejas",
];

// Multi-word phrases. Matched as substring on normalized text (with spaces preserved).
const BAD_PHRASES = [
  "kill yourself",
  "kill your self",
  "go die",
  "puta madre",
  "hijo de puta",
  "hija de puta",
  "vete a la verga",
  "chinga tu madre",
  "que se mueran",
  "child porn",
  "wtf",
  "stfu",
  "gtfo",
  "lmfao",
  "screw you",
  "go to hell",
  "piece of shit",
  "son of a bitch",
  "eat shit",
];

const SUBSTRING_PRECOMPUTED = SUBSTRING_BLOCKED.map((w) => ({
  raw: w,
  collapsed: w.replace(/(.)\1+/g, "$1"),
}));

const TOKEN_SET = new Set(TOKEN_BLOCKED);

const NORMALIZED_PHRASES = BAD_PHRASES.map((p) =>
  p
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""),
);

/**
 * @returns {string|null} the matching blocklist term, or null when clean.
 */
export function findBlockedTerm(text) {
  if (!text) return null;

  // Phrase scan over normalized text (spaces preserved).
  const normalizedFlat = normalize(text).replace(/[^a-z\s]+/g, " ");
  const normalizedSingleSpace = normalizedFlat.replace(/\s+/g, " ").trim();
  for (const phrase of NORMALIZED_PHRASES) {
    if (normalizedSingleSpace.includes(phrase)) return phrase;
  }

  const tokens = tokensOf(text);
  const collapsed = collapseOf(text);

  // Substring match (catches "fuuck", "f u c k", "f.u.c.k").
  for (const { raw, collapsed: rawCollapsed } of SUBSTRING_PRECOMPUTED) {
    if (collapsed.includes(rawCollapsed)) return raw;
  }

  // Whole-word token match for shorter / ambiguous terms.
  for (const t of tokens) {
    if (TOKEN_SET.has(t)) return t;
  }

  return null;
}

export function isBlocked(text) {
  return findBlockedTerm(text) !== null;
}

export const _internal = { normalize, tokensOf, collapseOf };
