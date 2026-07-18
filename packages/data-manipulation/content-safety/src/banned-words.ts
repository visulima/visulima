/**
 * Banned words list for content safety filtering.
 *
 * Each language has its own file in `./words/` for maintainability.
 * All languages are checked simultaneously regardless of user locale.
 *
 * Sources:
 * - Curated list (slurs, hate speech, violence, explicit content)
 * - https://github.com/coffee-and-fun/google-profanity-words
 * - https://github.com/viddexa/safetext
 */
import ar from "./words/ar";
import az from "./words/az";
import de from "./words/de";
import en from "./words/en";
import es from "./words/es";
import fa from "./words/fa";
import fr from "./words/fr";
import ga from "./words/ga";
import hi from "./words/hi";
import it from "./words/it";
import ja from "./words/ja";
import ko from "./words/ko";
import nl from "./words/nl";
import pl from "./words/pl";
import pt from "./words/pt";
import ru from "./words/ru";
import sv from "./words/sv";
import tr from "./words/tr";
import zh from "./words/zh";

/**
 * Comprehensive banned words dictionary organized by language code.
 *
 * Contains curated lists of profanity, slurs, hate speech, and explicit content
 * across 19 languages. Each language is represented by its ISO 639-1 code.
 * @remarks
 * - All words are checked simultaneously regardless of user locale
 * - Words are normalized to NFC Unicode form for consistent matching
 * - Multi-word phrases are supported (e.g., "white trash")
 * - Leet-speak variants are included where applicable
 *
 * The object is **deeply frozen** (`Object.freeze` on the container and on every language array):
 * replacing a property (`BANNED_WORDS.en = [...]`) or mutating a list (`BANNED_WORDS.en.push(...)`)
 * throws in strict mode (and is a silent no-op otherwise). To match against a custom dictionary or
 * allowlist, use the `createChecker` factory instead.
 * @example
 * ```typescript
 * import { BANNED_WORDS } from "@visulima/content-safety";
 *
 * console.log(Object.keys(BANNED_WORDS)); // ['ar', 'az', 'de', 'en', ...]
 * console.log(BANNED_WORDS.en.length); // Number of English banned words
 * ```
 * @public
 */
// eslint-disable-next-line import/prefer-default-export
export const BANNED_WORDS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
    /** Arabic banned words */
    ar: Object.freeze(ar),
    /** Azerbaijani banned words */
    az: Object.freeze(az),
    /** German banned words */
    de: Object.freeze(de),
    /** English banned words */
    en: Object.freeze(en),
    /** Spanish banned words */
    es: Object.freeze(es),
    /** Persian/Farsi banned words */
    fa: Object.freeze(fa),
    /** French banned words */
    fr: Object.freeze(fr),
    /** Irish banned words */
    ga: Object.freeze(ga),
    /** Hindi banned words */
    hi: Object.freeze(hi),
    /** Italian banned words */
    it: Object.freeze(it),
    /** Japanese banned words */
    ja: Object.freeze(ja),
    /** Korean banned words */
    ko: Object.freeze(ko),
    /** Dutch banned words */
    nl: Object.freeze(nl),
    /** Polish banned words */
    pl: Object.freeze(pl),
    /** Portuguese banned words */
    pt: Object.freeze(pt),
    /** Russian banned words */
    ru: Object.freeze(ru),
    /** Swedish banned words */
    sv: Object.freeze(sv),
    /** Turkish banned words */
    tr: Object.freeze(tr),
    /** Chinese banned words */
    zh: Object.freeze(zh),
});
