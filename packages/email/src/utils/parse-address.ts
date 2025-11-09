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

        if (!validateEmail(email)) {
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

        if (!validateEmail(email)) {
            return undefined;
        }

        return { email };
    }

    // Check for plain email format: "email@domain.com"
    if (validateEmail(trimmed)) {
        return { email: trimmed };
    }

    return undefined;
};
