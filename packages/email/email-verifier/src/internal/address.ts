/**
 * Matches a trailing dot in a domain (e.g. a fully-qualified `example.com.`).
 * Hoisted to module scope so it is compiled once rather than per call.
 */
const TRAILING_DOT_REGEX = /\.$/;

/**
 * Matches any whitespace character (space, tab, CR, LF, …). A real address
 * contains none, so its presence after trimming signals a malformed or
 * injection-bearing input — in particular an embedded CRLF that would smuggle a
 * second SMTP command. Hoisted so the regex is compiled once.
 */
const WHITESPACE_REGEX = /\s/;

/**
 * The split parts of an email address.
 */
interface AddressParts {
    /** The full normalized (lowercased, trimmed) address. */
    address: string;
    /** The domain part, lowercased and with any trailing dot stripped. */
    domain: string;
    /** The local part (before the `@`), lowercased. */
    localPart: string;
}

/**
 * Splits an email address into its normalized local and domain parts.
 *
 * Uses the last `@` as the separator so quoted local parts containing `@` are
 * handled the same way the SMTP/MX probes treat them. Inputs containing
 * whitespace (after trimming) are rejected so a payload that embeds a CRLF
 * followed by a second SMTP command cannot be smuggled into the SMTP dialogue
 * by callers of the standalone probes.
 * @param email The email address to split.
 * @returns The normalized parts, or `undefined` if the address is structurally invalid.
 */
const splitAddress = (email: string): AddressParts | undefined => {
    if (!email || typeof email !== "string") {
        return undefined;
    }

    const normalized = email.trim().toLowerCase();

    if (WHITESPACE_REGEX.test(normalized)) {
        return undefined;
    }

    const atIndex = normalized.lastIndexOf("@");

    if (atIndex <= 0 || atIndex === normalized.length - 1) {
        return undefined;
    }

    const localPart = normalized.slice(0, atIndex);
    const domain = normalized.slice(atIndex + 1).replace(TRAILING_DOT_REGEX, "");

    if (!localPart || !domain) {
        return undefined;
    }

    return { address: normalized, domain, localPart };
};

/**
 * Extracts and normalizes just the domain from an email address.
 * @param email The email address to extract the domain from.
 * @returns The normalized domain, or `undefined` if invalid.
 */
const extractDomain = (email: string): string | undefined => splitAddress(email)?.domain;

export type { AddressParts };
export { extractDomain, splitAddress };
