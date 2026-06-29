import { splitAddress } from "../internal/address";

/**
 * The result of local-part character analysis.
 */
interface CharacterResult {
    /** Ratio of digits to total characters in the local part (0–1). */
    digitRatio: number;
    /** True when the local part looks irregular / machine-generated / risky. */
    irregular: boolean;
    /** Length of the local part. */
    length: number;
    /** Human-readable reasons contributing to the `irregular` verdict. */
    reasons: string[];
}

const LONG_LOCAL_PART = 30;
const HIGH_DIGIT_RATIO = 0.6;
const LONG_CONSONANT_RUN = 7;

const DIGIT_REGEX = /\d/g;
const CONSONANT_RUN_REGEX = /[bcdfghj-np-tvwxz]{7,}/;
const REPEATED_CHAR_REGEX = /(.)\1{4,}/;

/**
 * Analyzes the local part of an email for irregular characteristics that
 * correlate with low-quality, spam-trap, or machine-generated addresses.
 *
 * Heuristic and intentionally conservative — it flags *patterns* (excessive
 * length, digit-heavy locals, long unpronounceable consonant runs, long repeats)
 * rather than asserting invalidity.
 * @param email The email address to analyze.
 * @returns The character analysis result.
 * @example
 * ```ts
 * import { analyzeCharacters } from "@visulima/email-verifier/checks/character";
 *
 * analyzeCharacters("aaaaaaa@example.com").irregular; // long repeat ⇒ true
 * ```
 */
const analyzeCharacters = (email: string): CharacterResult => {
    const parts = splitAddress(email);

    if (!parts) {
        return { digitRatio: 0, irregular: true, length: 0, reasons: ["invalid-format"] };
    }

    const { localPart } = parts;
    const reasons: string[] = [];

    const digitCount = (localPart.match(DIGIT_REGEX) ?? []).length;
    const digitRatio = localPart.length === 0 ? 0 : digitCount / localPart.length;

    if (localPart.length > LONG_LOCAL_PART) {
        reasons.push("excessive-length");
    }

    if (digitRatio >= HIGH_DIGIT_RATIO && localPart.length > 4) {
        reasons.push("digit-heavy");
    }

    if (CONSONANT_RUN_REGEX.test(localPart)) {
        reasons.push(`consonant-run-${String(LONG_CONSONANT_RUN)}+`);
    }

    if (REPEATED_CHAR_REGEX.test(localPart)) {
        reasons.push("repeated-character");
    }

    return { digitRatio, irregular: reasons.length > 0, length: localPart.length, reasons };
};

export type { CharacterResult };
export { analyzeCharacters };
export default analyzeCharacters;
