/**
 * Polish banned words
 *
 * Sources:
 * - Curated list
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
const words: ReadonlyArray<string> = [
    "kurwa",
    "kurwy",
    "chuj",
    "chuje",
    "pizda",
    "pizdy",
    "jebac",
    "jebany",
    "jebana",
    "skurwysyn",
    "skurwiel",
    "szmata",
    "szmaty",
    "dziwka",
    "dziwki",
    "pedał",
    "pedaly",
    "ciota",
    "cioty",
    "cwel",
    "cwele",
    "zyd",
    "zydy",
    "zydostwo",
    "czarnuch",
    "czarnuchy",
    "ciapaty",
    "ciapaci",
    "cygan",
    "cygany",
    "kurwa mac",
    "pierdol sie",
    "dupa",
    "dupek",
    "dupki",
    "debil",
    "debile",
    "idiota",
    "mongol",
    "mongoly",
    "gwalcic",
] as const;

export default words;
