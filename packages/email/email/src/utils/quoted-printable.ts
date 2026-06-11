// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
const hasBuffer = globalThis.Buffer !== undefined;

const HEX_PAIR_REGEX = /^[\da-f]{2}$/i;

const toBytes = (value: string): Uint8Array => {
    if (hasBuffer) {
        return Uint8Array.from(Buffer.from(value, "utf8"));
    }

    return new TextEncoder().encode(value);
};

const bytesToUtf8 = (bytes: Uint8Array): string => {
    if (hasBuffer) {
        return Buffer.from(bytes).toString("utf8");
    }

    return new TextDecoder().decode(bytes);
};

const encodeByte = (byte: number): string => `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;

/**
 * Encodes one logical line's bytes as quoted-printable tokens (no soft-wrapping yet).
 * @param bytes The UTF-8 bytes of a single source line.
 * @returns The per-character QP tokens for that line.
 */
const encodeLineTokens = (bytes: Uint8Array): string[] => {
    const tokens: string[] = [];

    for (let index = 0; index < bytes.length; index += 1) {
        const byte = bytes[index] as number;
        const isLast = index === bytes.length - 1;

        if (byte === 0x09 || byte === 0x20) {
            // Tab or space: must be encoded only when it is the last char on the line.
            tokens.push(isLast ? encodeByte(byte) : String.fromCodePoint(byte));
        } else if (byte >= 0x21 && byte <= 0x7E && byte !== 0x3D) {
            // Printable ASCII except '='.
            tokens.push(String.fromCodePoint(byte));
        } else {
            tokens.push(encodeByte(byte));
        }
    }

    return tokens;
};

/**
 * Soft-wraps a line's tokens at 76 characters with a trailing '=' soft break.
 * @param tokens The QP tokens for the line.
 * @returns The soft-wrapped line.
 */
const softWrap = (tokens: string[]): string => {
    let current = "";
    const wrapped: string[] = [];

    for (const token of tokens) {
        if (current.length + token.length > 75) {
            wrapped.push(`${current}=`);
            current = "";
        }

        current += token;
    }

    wrapped.push(current);

    return wrapped.join("\r\n");
};

/**
 * Encodes a string as RFC 2045 §6.7 quoted-printable.
 *
 * Used for `text/plain` and `text/html` bodies that contain non-ASCII (UTF-8) content so the message
 * remains a standards-compliant 7-bit-safe MIME part instead of being mislabelled
 * `Content-Transfer-Encoding: 7bit` while carrying raw UTF-8 octets.
 *
 * Rules applied: bytes outside the printable ASCII range (and `=`) become `=XX` (upper-case hex);
 * tabs/spaces are passed through except at end of line, where they are encoded; existing CRLF / LF
 * line breaks are preserved as hard line breaks; lines are soft-wrapped at 76 chars with a `=`.
 * @param input The UTF-8 string to encode.
 * @returns The quoted-printable encoded string with CRLF line endings.
 */
const encodeQuotedPrintable = (input: string): string => {
    // Normalise line endings to LF first so we can re-emit consistent CRLF.
    const normalized = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

    return normalized
        .split("\n")
        .map((line) => softWrap(encodeLineTokens(toBytes(line))))
        .join("\r\n");
};

/**
 * Decodes an RFC 2045 §6.7 quoted-printable body back to a UTF-8 string.
 *
 * Reverses {@link encodeQuotedPrintable}: removes soft line breaks (`=` at end of line), turns `=XX`
 * hex escapes back into octets, and decodes the resulting byte stream as UTF-8.
 * @param input The quoted-printable encoded string.
 * @returns The decoded UTF-8 string.
 */
const decodeQuotedPrintable = (input: string): string => {
    // Remove soft line breaks: '=' immediately followed by CRLF or LF.
    const withoutSoftBreaks = input.replaceAll(/=\r?\n/g, "");
    const bytes: number[] = [];

    for (let index = 0; index < withoutSoftBreaks.length; index += 1) {
        const char = withoutSoftBreaks[index] as string;

        if (char === "=" && index + 2 < withoutSoftBreaks.length) {
            const hex = withoutSoftBreaks.slice(index + 1, index + 3);

            if (HEX_PAIR_REGEX.test(hex)) {
                bytes.push(Number.parseInt(hex, 16));
                index += 2;
            } else {
                // eslint-disable-next-line unicorn/prefer-code-point
                bytes.push(char.charCodeAt(0));
            }
        } else {
            // eslint-disable-next-line unicorn/prefer-code-point
            bytes.push(char.charCodeAt(0));
        }
    }

    return bytesToUtf8(Uint8Array.from(bytes));
};

export { decodeQuotedPrintable, encodeQuotedPrintable };
export default encodeQuotedPrintable;
