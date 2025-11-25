import type { EmailAddress } from "../types";
import { validateEmail } from "./validate-email";

/**
 * Parses a string representation of an email address into an EmailAddress object.
 * Supports formats: "email@example.com", "Name &lt;email@example.com>", "&lt;email@example.com>"
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
 * @param address The string representation of the address to parse
 * @returns An EmailAddress object if parsing is successful, or undefined if invalid
 */
export const parseAddress = (address: string): EmailAddress | undefined => {
    if (!address || typeof address !== "string") {
        return undefined;
    }

    const trimmed = address.trim();

    if (!trimmed) {
        return undefined;
    }

    // Check for name and angle bracket format: "Name <email@domain.com>"
    const nameAngleBracketMatch = trimmed.match(/^(.+?)\s*<(.+?)>$/);

    if (nameAngleBracketMatch) {
        const name = nameAngleBracketMatch[1].trim();
        const email = nameAngleBracketMatch[2].trim();

        if (!isValidEmailFormat(email)) {
            return undefined;
        }

        // Remove quotes from name if present
        const cleanName = name.replace(/^"(.+)"$/, "$1");

        return { email, name: cleanName };
    }

    // Check for angle bracket format without name: "<email@domain.com>"
    const angleBracketMatch = trimmed.match(/^<(.+?)>$/);

    if (angleBracketMatch) {
        const email = angleBracketMatch[1].trim();

        if (!isValidEmailFormat(email)) {
            return undefined;
        }

        return { email };
    }

    // Check for invalid patterns first
    // Domain literal with only closing bracket (invalid) - must have @[ for valid domain literal
    if (trimmed.includes("]") && !trimmed.includes("@[")) {
        return undefined;
    }

    // Check for quote in middle (not at start) - invalid pattern like unterminated"@example.com
    // Valid quotes should only be at the start for quoted local parts: "quoted"@domain
    if (trimmed.includes('"') && !trimmed.startsWith('"')) {
        // Quote exists but not at start - invalid unless it's part of a name in angle brackets
        // But for plain email format, quotes in the middle are invalid
        const quoteIndex = trimmed.indexOf('"');

        // If quote appears before @ and it's not at the start, it's invalid for plain email
        if (quoteIndex < trimmed.indexOf('@')) {
            return undefined;
        }
    }

    // Check for unterminated quoted string: "unterminated@example.com (missing closing quote)
    // Valid pattern should be: "quoted"@domain
    // We need to find the @ that comes AFTER the closing quote, not inside the quotes
    if (trimmed.startsWith('"')) {
        let i = 1;
        let foundClosingQuote = false;

        // Look for the closing quote (allowing escaped quotes)
        while (i < trimmed.length) {
            if (trimmed[i] === '\\' && i + 1 < trimmed.length) {
                // Skip escaped character
                i += 2;
            } else if (trimmed[i] === '"') {
                // Found a quote - check if it's followed by @
                if (i + 1 < trimmed.length && trimmed[i + 1] === '@') {
                    // This is the closing quote for a quoted local part: "quoted"@domain
                    foundClosingQuote = true;
                    break;
                }
                // Quote not followed by @, continue
                i++;
            } else {
                i++;
            }
        }

        // If we have a quote at the start but no proper closing quote followed by @,
        // and there's an @ in the string, it's likely unterminated
        if (!foundClosingQuote && trimmed.includes('@')) {
            // Check if @ appears before any closing quote - that's invalid
            const firstAt = trimmed.indexOf('@');
            const firstQuoteAfterStart = trimmed.slice(1).indexOf('"');

            if (firstQuoteAfterStart === -1 || firstAt < firstQuoteAfterStart + 1) {
                // No closing quote found, or @ appears before closing quote - unterminated
                return undefined;
            }
        }
    }

    // Check for plain email format: "email@domain.com"
    if (isValidEmailFormat(trimmed)) {
        return { email: trimmed };
    }

    return undefined;
};

/**
 * Validates email format including quoted local parts and domain literals
 */
const isValidEmailFormat = (email: string): boolean => {
    // Check for domain literal format: user@[192.168.1.1]
    // Must have both opening and closing brackets
    const domainLiteralMatch = email.match(/^(.+)@\[([^\]]+)\]$/);

    if (domainLiteralMatch) {
        const localPart = domainLiteralMatch[1];
        const domainLiteral = domainLiteralMatch[2];

        // Domain literal must be valid (IP address or domain)
        if (!domainLiteral || domainLiteral.trim().length === 0) {
            return false;
        }

        // Local part validation (can be quoted or unquoted)
        return isValidLocalPart(localPart);
    }

    // Check for invalid domain literal (missing closing bracket)
    if (email.includes("@[") && !email.includes("]")) {
        return false;
    }

    // Check for quoted local part: "user@domain"@example.com
    // Handle escaped quotes and backslashes in the quoted string
    // The pattern allows any characters (including @) inside the quotes when properly escaped
    const quotedLocalMatch = email.match(/^"((?:[^"\\]|\\.)+)"@(.+)$/);

    if (quotedLocalMatch) {
        const domain = quotedLocalMatch[2];

        // Domain must be valid (not a domain literal in this case)
        // Check that domain doesn't start with [
        if (domain.startsWith("[")) {
            return false;
        }

        return validateEmail(`test@${domain}`);
    }

    // Standard email validation
    return validateEmail(email);
};

/**
 * Validates local part (can be quoted or unquoted)
 */
const isValidLocalPart = (localPart: string): boolean => {
    // Remove quotes if present
    const unquoted = localPart.replace(/^"(.+)"$/, "$1");

    // Basic validation: no empty, no consecutive dots, no leading/trailing dots
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
