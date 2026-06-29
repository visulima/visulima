import { splitAddress } from "../internal/address";

/**
 * The result of symbol / Unicode analysis.
 */
interface SymbolResult {
    /** True when the address mixes Unicode scripts (a homoglyph-spoofing signal). */
    hasMixedScripts: boolean;
    /** True when the address contains non-ASCII characters anywhere. */
    hasNonAscii: boolean;
    /** True when the local part or domain contains symbol/emoji characters. */
    hasSymbols: boolean;
    /** The distinct Unicode scripts detected (e.g. ["Latin", "Cyrillic"]). */
    scripts: string[];
}

// Anything outside the ASCII block (U+0000–U+007F) — i.e. any non-ASCII character.
const NON_ASCII_REGEX = /\P{ASCII}/u;
// Symbol & emoji general categories (Sm, Sc, Sk, So) — excludes ordinary letters/marks.
const SYMBOL_REGEX = /\p{S}/u;

const SCRIPT_REGEXES: ReadonlyArray<[string, RegExp]> = [
    ["Latin", /\p{Script=Latin}/u],
    ["Cyrillic", /\p{Script=Cyrillic}/u],
    ["Greek", /\p{Script=Greek}/u],
    ["Han", /\p{Script=Han}/u],
    ["Hiragana", /\p{Script=Hiragana}/u],
    ["Katakana", /\p{Script=Katakana}/u],
    ["Hangul", /\p{Script=Hangul}/u],
    ["Arabic", /\p{Script=Arabic}/u],
    ["Hebrew", /\p{Script=Hebrew}/u],
];

/**
 * Detects symbols, emoji, and mixed Unicode scripts in an email address.
 *
 * Mixed-script local parts (e.g. Latin + Cyrillic) are a classic homoglyph /
 * spoofing signal; symbol or emoji characters indicate a non-standard address.
 * @param email The email address to analyze.
 * @returns The symbol analysis result.
 * @example
 * ```ts
 * import { analyzeSymbols } from "@visulima/email-verifier/checks/symbol";
 *
 * analyzeSymbols("раypal@example.com").hasMixedScripts; // true (Cyrillic "ра")
 * ```
 */
const analyzeSymbols = (email: string): SymbolResult => {
    const parts = splitAddress(email);

    if (!parts) {
        return { hasMixedScripts: false, hasNonAscii: false, hasSymbols: false, scripts: [] };
    }

    // Analyze the local part + domain label characters, ignoring the structural "@".
    const subject = `${parts.localPart}${parts.domain}`;

    const scripts = SCRIPT_REGEXES.filter(([, regex]) => regex.test(subject)).map(([name]) => name);

    return {
        hasMixedScripts: scripts.length > 1,
        hasNonAscii: NON_ASCII_REGEX.test(parts.address),
        hasSymbols: SYMBOL_REGEX.test(subject),
        scripts,
    };
};

export type { SymbolResult };
export { analyzeSymbols };
export default analyzeSymbols;
