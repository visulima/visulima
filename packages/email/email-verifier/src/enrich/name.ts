import { splitAddress } from "../internal/address";

/**
 * A name parsed from an email's local part.
 */
interface NameResult {
    /** Confidence in the parse: `high` (clear separator), `medium` (camelCase), `low` (heuristic), `none`. */
    confidence: "high" | "low" | "medium" | "none";
    /** The detected first name, capitalized, if any. */
    firstName?: string;
    /** The detected first + last name joined, if any. */
    fullName?: string;
    /** The detected last name, capitalized, if any. */
    lastName?: string;
}

const SEPARATOR_REGEX = /[.\-_]/;
const CAMEL_CASE_REGEX = /^[a-z]+(?:[A-Z][a-z]+)+$/;
// eslint-disable-next-line sonarjs/slow-regex -- anchored single-pass match, no catastrophic backtracking
const TRAILING_DIGITS_REGEX = /\d+$/;
const HAS_DIGIT_REGEX = /\d/;

const capitalize = (value: string): string => {
    if (value.length === 0) {
        return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

const splitCamelCase = (value: string): string[] => value.replaceAll(/([a-z])([A-Z])/g, "$1 $2").split(" ");

/**
 * Heuristically parses a person's name from the local part of an email address.
 *
 * Handles separator-delimited (`john.doe`), camelCase (`johnDoe`), and
 * single-token local parts, stripping trailing digits. This is best-effort name
 * parsing only — no gender detection — and confidence is reported so callers
 * can decide how much to trust it.
 * @param email The email address to parse.
 * @returns The parsed name and a confidence level.
 * @example
 * ```ts
 * import { parseName } from "@visulima/email-verifier/enrich/name";
 *
 * parseName("john.doe@example.com");
 * // { firstName: "John", lastName: "Doe", fullName: "John Doe", confidence: "high" }
 * ```
 */
const parseName = (email: string): NameResult => {
    const parts = splitAddress(email);

    if (!parts) {
        return { confidence: "none" };
    }

    // Use the original-case local part so camelCase boundaries survive
    // (splitAddress lowercases). Fall back to the normalized part if needed.
    const atIndex = email.trim().lastIndexOf("@");
    const rawLocalPart = atIndex > 0 ? email.trim().slice(0, atIndex) : parts.localPart;

    // Drop any +tag and trailing digits before parsing.
    const base = (rawLocalPart.split("+")[0] as string).replace(TRAILING_DIGITS_REGEX, "");

    if (base.length === 0) {
        return { confidence: "none" };
    }

    let tokens: string[];
    let confidence: NameResult["confidence"];

    if (SEPARATOR_REGEX.test(base)) {
        tokens = base.split(SEPARATOR_REGEX).filter(Boolean);
        confidence = "high";
    } else if (CAMEL_CASE_REGEX.test(base)) {
        tokens = splitCamelCase(base);
        confidence = "medium";
    } else {
        // Single opaque token — only usable as a first name, and only if it has no digits.
        if (HAS_DIGIT_REGEX.test(base)) {
            return { confidence: "none" };
        }

        return { confidence: "low", firstName: capitalize(base), fullName: capitalize(base) };
    }

    const cleaned = tokens.map((token) => token.replace(TRAILING_DIGITS_REGEX, "")).filter(Boolean);

    if (cleaned.length === 0) {
        return { confidence: "none" };
    }

    const firstName = capitalize(cleaned[0] as string);

    if (cleaned.length === 1) {
        return { confidence: "low", firstName, fullName: firstName };
    }

    const lastName = capitalize(cleaned.at(-1) as string);

    return { confidence, firstName, fullName: `${firstName} ${lastName}`, lastName };
};

export type { NameResult };
export { parseName };
export default parseName;
