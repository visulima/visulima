import type { EmailAddress } from "../types";

const INVALID_ADDR_SPEC = /[\r\n<>]/;

/**
 * Sanitizes a display name for use in a quoted email header per RFC 5322.
 *
 * Replaces CR/LF/tab with a single space, strips non-printable control characters, escapes
 * backslashes and double quotes, then trims and collapses runs of whitespace. This prevents header
 * injection when an attacker-controlled display name is placed into a signed `From`/`To`/`Cc` header.
 * @param name The display name to sanitize.
 * @returns The sanitized display name, or an empty string if nothing printable remains.
 */
export const sanitizeDisplayName = (name: string): string => {
    let sanitized = name.replaceAll(/[\r\n\t]+/g, " ");

    // Strip control characters (0x00-0x1F, 0x7F-0x9F) while keeping printable ASCII and Unicode.
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    sanitized = [...sanitized]
        .filter((char) => {
            const code = char.codePointAt(0);

            if (code === undefined) {
                return false;
            }

            return (code >= 0x20 && code <= 0x7e) || code > 0x9f;
        })
        .join("");

    const backslashChar = "\\";
    const quoteChar = "\"";

    sanitized = sanitized.replaceAll(backslashChar, backslashChar + backslashChar).replaceAll(quoteChar, backslashChar + quoteChar);

    return sanitized.trim().replaceAll(/\s+/g, " ");
};

/**
 * Formats a single email address as a header value, quoting and sanitizing the display name.
 * @param address The email address to format.
 * @returns A quoted `"Name" &lt;email>` string, or the bare email when there is no usable name.
 * @throws {Error} When the address contains CR/LF or angle brackets that would break the header.
 */
export const formatAddress = (address: EmailAddress): string => {
    if (INVALID_ADDR_SPEC.test(address.email)) {
        // The addr-spec is interpolated verbatim into a signed header; CR/LF or angle brackets would
        // allow header injection, so reject rather than emit a malformed/forged header.
        throw new Error("Invalid email address for header formatting");
    }

    if (address.name) {
        const sanitizedName = sanitizeDisplayName(address.name);

        if (sanitizedName) {
            return `"${sanitizedName}" <${address.email}>`;
        }
    }

    return address.email;
};

/**
 * Formats one or more email addresses as a comma-separated header value.
 * @param addresses The email address(es) to format.
 * @returns The formatted, comma-separated address list.
 */
export const formatAddresses = (addresses: EmailAddress | EmailAddress[]): string => {
    const list = Array.isArray(addresses) ? addresses : [addresses];

    return list.map((address) => formatAddress(address)).join(", ");
};
