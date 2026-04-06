/**
 * Dutch banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "neger",
    "negers",
    "nikker",
    "nikkers",
    "zwartjoekel",
    "roetmop",
    "spleetoog",
    "spleetogen",
    "kankerjood",
    "jood",
    "mof",
    "moffen",
    "flikker",
    "flikkers",
    "nicht",
    "nichten",
    "pot",
    "potten",
    "hoer",
    "hoeren",
    "slet",
    "sletten",
    "teef",
    "teven",
    "del",
    "dellen",
    "lul",
    "lullen",
    "klootzak",
    "klootzakken",
    "kut",
    "kutten",
    "eikel",
    "eikels",
    "godverdomme",
    "kanker",
    "tyfus",
    "tering",
    "pleuris",
    "kolere",
    "neuken",
    "neuk",
    "mongool",
    "mongolen",
    "debiel",
] as const;

export default words;
