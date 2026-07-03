/**
 * Italian banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "negro",
    "negri",
    "negra",
    "terrone",
    "terroni",
    "terrona",
    "marocchino",
    "vu cumpra",
    "muso giallo",
    "musi gialli",
    "ebreo di merda",
    "frocio",
    "froci",
    "finocchio",
    "finocchi",
    "ricchione",
    "ricchioni",
    "checca",
    "lesbicona",
    "lesbicone",
    "puttana",
    "puttane",
    "troia",
    "troie",
    "zoccola",
    "zoccole",
    "baldracca",
    "coglione",
    "coglioni",
    "stronzo",
    "stronza",
    "minchia",
    "cazzo",
    "cazzi",
    "vaffanculo",
    "fanculo",
    "merda",
    "figlio di puttana",
    "fica",
    "figa",
    "scopare",
    "scopata",
    "ritardato",
    "ritardati",
    "mongoloide",
] as const;

export default words;
