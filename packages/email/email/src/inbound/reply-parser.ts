/**
 * Locale-aware attribution lines that introduce a quoted reply (compared against the trimmed line).
 *
 * Matches English, German, French, Spanish, and Turkish quote headers.
 */
const ATTRIBUTION_PATTERNS: RegExp[] = [
    // English: "On Mon, Jan 1, 2024 at 10:00 AM, John Doe <john@x.com> wrote:"
    /^On .*wrote:$/i,
    // German: "Am 01.01.2024 um 10:00 schrieb John Doe:"
    /^Am .*schrieb.*:$/i,
    // French: "Le 1 janvier 2024 à 10:00, John Doe a écrit :"
    /^Le .*a écrit ?:$/i,
    // Spanish: "El 1 de enero de 2024, John Doe escribió:"
    /^El .*escribió:$/i,
    // Turkish: "1 Ocak 2024 Pazartesi tarihinde John Doe şunları yazdı:"
    /yazdı:$/i,
];

/**
 * Hard separators that unambiguously begin a quoted/forwarded section (compared against the trimmed line).
 */
const HARD_SEPARATORS: RegExp[] = [
    /^-{2,}\s*Original Message\s*-{2,}/i,
    /^-{2,}\s*Forwarded message\s*-{2,}/i,
    /^_{5,}$/, // Outlook's underscore divider
    /^Von: .+$/i, // German Outlook header block
    /^From: .+$/i, // English Outlook header block
];

const SIGNATURE_DELIMITER = /^--\s?$/;

/**
 * Tests whether a line marks the start of a quoted reply.
 * @param trimmed The already-trimmed line to test.
 * @returns `true` when the line begins quoted content.
 */
const isQuoteBoundary = (trimmed: string): boolean => {
    if (trimmed.startsWith(">")) {
        return true;
    }

    if (HARD_SEPARATORS.some((pattern) => pattern.test(trimmed))) {
        return true;
    }

    return ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(trimmed));
};

/**
 * Options for {@link extractReply}.
 */
export interface ExtractReplyOptions {
    /**
     * Also strip a trailing signature block (everything after a `-- ` delimiter line).
     * @default true
     */
    stripSignature?: boolean;
}

/**
 * Extracts the new reply text from a plain-text email body, stripping quoted history and (optionally)
 * the trailing signature.
 *
 * Uses the same heuristics email clients use: quote markers (`>`), localized attribution lines
 * (EN/DE/FR/ES/TR), Outlook/`Original Message` separators, and the RFC 3676 `-- ` signature delimiter.
 * @param text The plain-text body.
 * @param options Extraction options. See {@link ExtractReplyOptions}.
 * @returns The trimmed reply text with quoted history removed.
 */
export const extractReply = (text: string, options: ExtractReplyOptions = {}): string => {
    const { stripSignature = true } = options;

    const lines = text.replaceAll("\r\n", "\n").split("\n");
    const kept: string[] = [];

    for (const line of lines) {
        if (isQuoteBoundary(line.trim())) {
            break;
        }

        if (stripSignature && SIGNATURE_DELIMITER.test(line)) {
            break;
        }

        kept.push(line);
    }

    // Trim trailing blank lines that precede a stripped quote/signature.
    while (kept.length > 0 && (kept[kept.length - 1] as string).trim() === "") {
        kept.pop();
    }

    return kept.join("\n").trim();
};
