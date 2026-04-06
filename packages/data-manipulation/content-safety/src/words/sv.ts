/**
 * Swedish banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "neger",
    "negrer",
    "svarting",
    "blansen",
    "svansen",
    "bög",
    "bögar",
    "bögig",
    "flata",
    "flatare",
    "hora",
    "horor",
    "slampa",
    "slampor",
    "fitta",
    "fittor",
    "kuk",
    "kuken",
    "fan",
    "jävlar",
    "helvete",
    "knull",
    "knulla",
    "knullad",
    "skit",
    "skitstövel",
    "arsle",
    "rövhål",
    "mongo",
    "mongoler",
    "efterbliven",
    "våldtäkt",
] as const;

export default words;
