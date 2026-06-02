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
];

const SIGNATURE_DELIMITER = /^--\s?$/;

// An Outlook-style forwarded header block opens with `From:`/`Von:` AND is immediately followed by
// other header lines. Requiring the follow-up line avoids truncating prose like "From: my view, …".
const HEADER_BLOCK_START = /^(?:from|von):\s/i;
const HEADER_BLOCK_FOLLOW = /^(?:to|an|cc|sent|gesendet|date|datum|subject|betreff|reply-to):\s/i;

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
 * Detects an Outlook-style forwarded header block starting at `index`: a `From:`/`Von:` line followed
 * (within the next few non-blank lines) by another recognized header line.
 * @param lines All body lines.
 * @param index The index of the candidate `From:`/`Von:` line.
 * @returns `true` when a header block is detected.
 */
const isHeaderBlock = (lines: string[], index: number): boolean => {
    if (!HEADER_BLOCK_START.test((lines[index] ?? "").trim())) {
        return false;
    }

    let seen = 0;

    for (let next = index + 1; next < lines.length && seen < 3; next += 1) {
        const candidate = (lines[next] as string).trim();

        if (candidate === "") {
            continue;
        }

        seen += 1;

        if (HEADER_BLOCK_FOLLOW.test(candidate)) {
            return true;
        }
    }

    return false;
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

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] as string;

        if (isQuoteBoundary(line.trim()) || isHeaderBlock(lines, index)) {
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
