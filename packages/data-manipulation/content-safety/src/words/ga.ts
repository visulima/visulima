/**
 * Irish (Gaeilge) banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "cac",
    "píosa cac",
    "muc",
    "feck",
    "feckin",
    "bod",
    "póg mo thóin",
    "amadán",
    "eejit",
    "gobshite",
    "bastún",
    "lúdramán",
    "balbhán",
    "ainnis ort",
    "dún do chlab",
    "damnú ort",
] as const;

export default words;
