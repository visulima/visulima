import type { EmailAddress } from "../types";
import validateEmailDefault from "./validation/validate-email";

/**
 * Validates the local part of an email address (can be quoted or unquoted).
 * @param localPart The local part of the email address to validate.
 * @returns True if the local part is valid, false otherwise.
 */
const isValidLocalPart = (localPart: string): boolean => {
    const unquoted = localPart.replace(/^"(.+)"$/, "$1");

    if (!unquoted || unquoted.length === 0) {
        return false;
    }

    if (unquoted.includes("..")) {
        return false;
    }

    if (unquoted.startsWith(".") || unquoted.endsWith(".")) {
        return false;
    }

    return true;
};

/**
 * Validates email format including quoted local parts and domain literals.
 * @param email The email string to validate.
 * @returns True if the email format is valid, false otherwise.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const isValidEmailFormat = (email: string): boolean => {
    // Check for domain literal format without vulnerable regex backtracking
    // Pattern: localpart@[domain-literal]
    // Use indexOf to avoid regex backtracking vulnerabilities
    const atBracketIndex = email.indexOf("@[");

    if (atBracketIndex > 0 && email.endsWith("]")) {
        // Ensure there's only one @[ and it's the one we're matching
        // by checking that there's no @[ after the first one (before the closing bracket)
        const closingBracketIndex = email.length - 1;
        const domainLiteralSection = email.slice(atBracketIndex + 2, closingBracketIndex);

        // If there's another @[ in the domain literal section, it's invalid
        if (domainLiteralSection.includes("@[")) {
            return false;
        }

        const localPart = email.slice(0, atBracketIndex);
        const domainLiteral = domainLiteralSection;

        if (!domainLiteral || domainLiteral.trim().length === 0) {
            return false;
        }

        // Ensure no unescaped closing bracket in domain literal
        if (domainLiteral.includes("]")) {
            return false;
        }

        return localPart ? isValidLocalPart(localPart) : false;
    }

    if (email.includes("@[") && !email.includes("]")) {
        return false;
    }

    const quotedLocalMatch = email.match(/^"((?:[^"\\]|\\.)+)"@(.+)$/);

    if (quotedLocalMatch && quotedLocalMatch[2]) {
        const domain = quotedLocalMatch[2];

        if (domain.startsWith("[")) {
            return false;
        }

        return validateEmailDefault(`test@${domain}`);
    }

    return validateEmailDefault(email);
};

/**
 * Parses a string representation of an email address into an EmailAddress object.
 * Supports formats: "email@example.com", "Name &lt;email@example.com>", "&lt;email@example.com>".
 * @example Parsing an address with a name
 * ```ts
 * const address = parseAddress("John Doe <john@example.com>");
 * // { name: "John Doe", email: "john@example.com" }
 * ```
 * @example Parsing an address without a name
 * ```ts
 * const address = parseAddress("jane@example.com");
 * // { email: "jane@example.com" }
 * ```
 * @param address The string representation of the address to parse.
 * @returns An EmailAddress object if parsing is successful, or undefined if invalid.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseAddress = (address: string): EmailAddress | undefined => {
    if (!address || typeof address !== "string") {
        return undefined;
    }

    const trimmed = address.trim();

    if (!trimmed) {
        return undefined;
    }

    const lastOpenBracket = trimmed.lastIndexOf("<");
    const lastCloseBracket = trimmed.lastIndexOf(">");

    if (lastOpenBracket !== -1 && lastCloseBracket > lastOpenBracket) {
        const name = trimmed.slice(0, lastOpenBracket).trim();
        const email = trimmed.slice(lastOpenBracket + 1, lastCloseBracket).trim();

        if (email && isValidEmailFormat(email)) {
            if (name) {
                const cleanName = name.replace(/^"(.+)"$/, "$1");

                return { email, name: cleanName };
            }

            return { email };
        }
    }

    const angleBracketMatch = trimmed.match(/^<([^>]+)>$/);

    if (angleBracketMatch && angleBracketMatch[1]) {
        const email = angleBracketMatch[1].trim();

        if (!isValidEmailFormat(email)) {
            return undefined;
        }

        return { email };
    }

    if (trimmed.includes("]") && !trimmed.includes("@[")) {
        return undefined;
    }

    if (trimmed.includes("\"") && !trimmed.startsWith("\"")) {
        const quoteIndex = trimmed.indexOf("\"");

        if (quoteIndex < trimmed.indexOf("@")) {
            return undefined;
        }
    }

    if (trimmed.startsWith("\"")) {
        let i = 1;
        let foundClosingQuote = false;

        while (i < trimmed.length) {
            if (trimmed[i] === "\\" && i + 1 < trimmed.length) {
                i += 2;
            } else if (trimmed[i] === "\"") {
                if (i + 1 < trimmed.length && trimmed[i + 1] === "@") {
                    foundClosingQuote = true;
                    break;
                }

                i += 1;
            } else {
                i += 1;
            }
        }

        if (!foundClosingQuote && trimmed.includes("@")) {
            const firstAt = trimmed.indexOf("@");
            const firstQuoteAfterStart = trimmed.slice(1).indexOf("\"");

            if (firstQuoteAfterStart === -1 || firstAt < firstQuoteAfterStart + 1) {
                return undefined;
            }
        }
    }

    if (isValidEmailFormat(trimmed)) {
        return { email: trimmed };
    }

    return undefined;
};

export default parseAddress;
