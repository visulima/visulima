/**
 * Azerbaijani banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "agzyva tyokerem",
    "amcyghyna goyum",
    "anavi sikim",
    "axmaq",
    "chalmagh",
    "dashagymy yala",
    "dindiq",
    "dombaltmaq",
    "faishe",
    "gic",
    "gijdillaq",
    "gyotumu ye",
    "gyotyuve goyum",
    "it oghlu",
    "iyrenj",
    "meme",
    "memeni yeyim az",
    "meymun fars",
    "mongol",
    "mumla",
    "necheye chykhyrsan?",
    "oghrash",
    "pokh",
    "pokhuvu ye",
    "pox yeme",
    "qanchikh",
    "qehbe",
    "safeh",
    "sikim!",
    "sikime ki",
    "sikimi yala",
    "sikimin bashy",
    "sikishmek",
    "sikmek",
    "siktir",
    "sokh ichive",
    "terkereh bozi lagooten",
] as const;

export default words;
