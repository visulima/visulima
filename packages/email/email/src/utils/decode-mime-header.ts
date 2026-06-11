// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
const hasBuffer = globalThis.Buffer !== undefined;

const decodeBase64 = (value: string): Uint8Array => {
    if (hasBuffer) {
        return Uint8Array.from(Buffer.from(value, "base64"));
    }

    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        // eslint-disable-next-line unicorn/prefer-code-point
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
};

const decodeQp = (value: string): Uint8Array => {
    // RFC 2047 "Q" encoding: '_' represents a space, '=XX' is a hex octet.
    const normalized = value.replaceAll("_", " ");
    const bytes: number[] = [];

    for (let index = 0; index < normalized.length; index += 1) {
        const char = normalized[index] as string;

        if (char === "=" && index + 2 < normalized.length) {
            bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
            index += 2;
        } else {
            // eslint-disable-next-line unicorn/prefer-code-point
            bytes.push(char.charCodeAt(0));
        }
    }

    return Uint8Array.from(bytes);
};

const UTF8_CHARSET_REGEX = /^utf-?8$/i;

const bytesToString = (bytes: Uint8Array, charset: string): string => {
    if (hasBuffer && UTF8_CHARSET_REGEX.test(charset)) {
        return Buffer.from(bytes).toString("utf8");
    }

    try {
        return new TextDecoder(charset).decode(bytes);
    } catch {
        return new TextDecoder().decode(bytes);
    }
};

// Matches a single RFC 2047 encoded-word: =?charset?B|Q?text?=
const ENCODED_WORD_REGEX = /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi;

/**
 * Decodes an RFC 2047 encoded header value back to a plain string.
 *
 * Handles both "B" (base64) and "Q" (quoted-printable) encodings and joins
 * adjacent encoded-words (whitespace between two encoded-words is folding, per
 * RFC 2047 §6.2, and is dropped). Values without any encoded-word are returned
 * unchanged.
 * @param value The raw header value (possibly containing encoded-words).
 * @returns The decoded, human-readable header value.
 */
export const decodeMimeHeaderValue = (value: string): string => {
    if (!value.includes("=?")) {
        return value;
    }

    // Collapse whitespace separating adjacent encoded-words before decoding.
    const collapsed = value.replaceAll(/(\?=)\s+(=\?)/g, "$1$2");

    return collapsed.replaceAll(ENCODED_WORD_REGEX, (_match, charset: string, encoding: string, text: string) => {
        const bytes = encoding.toUpperCase() === "B" ? decodeBase64(text) : decodeQp(text);

        return bytesToString(bytes, charset);
    });
};

export default decodeMimeHeaderValue;
