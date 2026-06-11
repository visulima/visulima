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
 * The object is **frozen** (`Object.freeze`): mutating it (e.g. `BANNED_WORDS.en.push(...)`)
 * has no effect because the checker builds its lookup tables from a snapshot. To match against
 * a custom dictionary or allowlist, use the `createChecker` factory instead.
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
    ar,
    /** Azerbaijani banned words */
    az,
    /** German banned words */
    de,
    /** English banned words */
    en,
    /** Spanish banned words */
    es,
    /** Persian/Farsi banned words */
    fa,
    /** French banned words */
    fr,
    /** Irish banned words */
    ga,
    /** Hindi banned words */
    hi,
    /** Italian banned words */
    it,
    /** Japanese banned words */
    ja,
    /** Korean banned words */
    ko,
    /** Dutch banned words */
    nl,
    /** Polish banned words */
    pl,
    /** Portuguese banned words */
    pt,
    /** Russian banned words */
    ru,
    /** Swedish banned words */
    sv,
    /** Turkish banned words */
    tr,
    /** Chinese banned words */
    zh,
});
