import { splitAddress } from "../internal/address";

/**
 * Basic, permissive RFC-5322-style syntax check. Matches the local part, a
 * single `@`, and a dotted domain. Hoisted so the regex is compiled once.
 */

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

/**
 * A single hostname label may contain only letters (including Unicode/IDN),
 * digits, and hyphens — so `foo_bar` (underscore) and `exa!mple` (symbol) are
 * rejected, while ASCII punycode labels like `xn--80ak6aa92e` still pass.
 */
const DOMAIN_LABEL_REGEX = /^[\p{L}\p{N}-]+$/u;

/**
 * Validates an email address format according to basic RFC standards.
 *
 * This is intentionally pragmatic rather than a full RFC 5322 parser: it rejects
 * the address shapes that never deliver (missing parts, consecutive dots, leading
 * or trailing dots, hyphen-bounded domain labels) while accepting the long tail
 * of legitimate real-world addresses.
 * @param email The email address string to validate.
 * @returns True if the email address is syntactically valid, false otherwise.
 * @example
 * ```ts
 * import { validateSyntax } from "@visulima/email-verifier/checks/syntax";
 *
 * validateSyntax("user@example.com"); // true
 * validateSyntax("user@@example.com"); // false
 * ```
 */
const validateSyntax = (email: string): boolean => {
    if (!email || typeof email !== "string") {
        return false;
    }

    if (!BASIC_EMAIL_REGEX.test(email)) {
        return false;
    }

    // No consecutive dots anywhere.
    if (email.includes("..")) {
        return false;
    }

    const parts = splitAddress(email);

    if (!parts) {
        return false;
    }

    const { domain, localPart } = parts;

    // Local part shouldn't start or end with a dot.
    if (localPart.startsWith(".") || localPart.endsWith(".")) {
        return false;
    }

    // Domain must have at least one dot and not be bounded by hyphens.
    if (!domain.includes(".") || domain.startsWith("-") || domain.endsWith("-")) {
        return false;
    }

    // No domain label may be empty, hyphen-bounded, or contain non-hostname
    // characters (only letters, digits, and hyphens are allowed).
    return domain.split(".").every((label) => label.length > 0 && !label.startsWith("-") && !label.endsWith("-") && DOMAIN_LABEL_REGEX.test(label));
};

export { validateSyntax };
export default validateSyntax;
