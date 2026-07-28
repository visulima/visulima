import type { EmailAddress, EmailOptions } from "../types";
import decodeMimeHeaderValue from "./decode-mime-header";
import parseAddress from "./parse-address";
import { decodeQuotedPrintable } from "./quoted-printable";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison
const hasBuffer = globalThis.Buffer !== undefined;

const FOLDED_LINE_REGEX = /^[ \t]/;
const BOUNDARY_REGEX = /boundary=(?:"([^"]+)"|([^";]+))/i;
const LEADING_NEWLINE_REGEX = /^\r?\n/;
// Linear: a single character-class run anchored at the end; the heuristic flags the `+$`
// shape, but there is no nested/overlapping quantifier so no super-linear backtracking.
// eslint-disable-next-line sonarjs/slow-regex
const TRAILING_NEWLINES_REGEX = /[\r\n]+$/;
const TRAILING_NEWLINE_REGEX = /\r?\n$/;
const WHITESPACE_GLOBAL_REGEX = /\s/g;
const HIGH_PRIORITY_REGEX = /high|^1|^2/i;
const LOW_PRIORITY_REGEX = /low|^4|^5/i;

interface ParsedHeaders {
    map: Map<string, string>;
    raw: [string, string][];
}

/**
 * Splits a raw MIME section into its header block and body, unfolding folded
 * header lines (RFC 5322 §2.2.3) along the way.
 * @param section The raw section (headers + blank line + body).
 * @returns The parsed headers and the raw (still-encoded) body string.
 */
const splitHeadersAndBody = (section: string): { body: string; headers: ParsedHeaders } => {
    const normalized = section.replaceAll("\r\n", "\n");
    const separatorIndex = normalized.indexOf("\n\n");
    const headerBlock = separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex);
    const body = separatorIndex === -1 ? "" : normalized.slice(separatorIndex + 2);

    const raw: [string, string][] = [];
    const map = new Map<string, string>();

    let currentName = "";
    let currentValue = "";

    const flush = (): void => {
        if (currentName) {
            const decoded = decodeMimeHeaderValue(currentValue.trim());

            raw.push([currentName, decoded]);
            map.set(currentName.toLowerCase(), decoded);
        }
    };

    for (const line of headerBlock.split("\n")) {
        if (FOLDED_LINE_REGEX.test(line) && currentName) {
            // Folded continuation line.
            currentValue += ` ${line.trim()}`;
        } else {
            flush();

            const colonIndex = line.indexOf(":");

            if (colonIndex === -1) {
                currentName = "";
                currentValue = "";
            } else {
                currentName = line.slice(0, colonIndex).trim();
                currentValue = line.slice(colonIndex + 1).trim();
            }
        }
    }

    flush();

    return { body, headers: { map, raw } };
};

/**
 * Parses an address-list header value into EmailAddress objects.
 * @param value The header value (may contain multiple comma-separated addresses).
 * @returns The parsed addresses (invalid entries are skipped).
 */
const parseAddressList = (value: string): EmailAddress[] => {
    if (!value) {
        return [];
    }

    // Split on commas that are not inside quotes or angle brackets.
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let inAngle = false;

    for (const char of value) {
        switch (char) {
            case "\"": {
                inQuotes = !inQuotes;
                break;
            }
            case "<": {
                inAngle = true;
                break;
            }
            case ">": {
                inAngle = false;
                break;
            }
            default: {
                break;
            }
        }

        if (char === "," && !inQuotes && !inAngle) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    if (current.trim()) {
        parts.push(current);
    }

    return parts.map((part) => parseAddress(part.trim())).filter((address): address is EmailAddress => address !== undefined);
};

const getBoundary = (contentType: string | undefined): string | undefined => {
    if (!contentType) {
        return undefined;
    }

    const match = BOUNDARY_REGEX.exec(contentType);

    return match?.[1] ?? match?.[2];
};

const decodeBody = (body: string, encoding: string | undefined): string => {
    const normalizedEncoding = (encoding ?? "7bit").trim().toLowerCase();

    if (normalizedEncoding === "quoted-printable") {
        return decodeQuotedPrintable(body);
    }

    if (normalizedEncoding === "base64") {
        const cleaned = body.replaceAll(WHITESPACE_GLOBAL_REGEX, "");

        if (hasBuffer) {
            return Buffer.from(cleaned, "base64").toString("utf8");
        }

        return new TextDecoder().decode(Uint8Array.from(atob(cleaned), (c) => c.codePointAt(0) as number));
    }

    return body;
};

/**
 * Parses a raw EML / RFC 5322 MIME message back into {@link EmailOptions}.
 *
 * This closes the round-trip story for {@link "../mail".Mail.draft}: serialise a
 * message to EML, persist/transmit it, then `parseEml()` it back into options you
 * can hand to `mail.send()`. It understands the multipart layout produced by this
 * library's own `buildMimeMessage` (text/plain + text/html parts, quoted-printable
 * and base64 transfer encodings, RFC 2047 encoded headers) and common
 * single-part messages.
 *
 * Scope: it extracts `from`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `text`,
 * `html`, `priority`, and remaining custom `headers`. Attachment bodies are not
 * decoded into {@link "../types".Attachment} objects (use a full MIME parser such
 * as `mailparser` for that); attachment parts are skipped.
 * @param eml The raw EML/MIME message string.
 * @returns The parsed email options.
 * @throws {Error} When the message has no `From` or `To`/`Cc`/`Bcc` recipient and therefore cannot satisfy the required {@link EmailOptions} shape.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseEml = (eml: string): EmailOptions => {
    const { body, headers } = splitHeadersAndBody(eml);
    const { map } = headers;

    const from = parseAddress(map.get("from") ?? "");

    if (!from) {
        throw new Error("Cannot parse EML: missing or invalid `From` header");
    }

    const to = parseAddressList(map.get("to") ?? "");
    const cc = parseAddressList(map.get("cc") ?? "");
    const bcc = parseAddressList(map.get("bcc") ?? "");

    if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
        throw new Error("Cannot parse EML: no recipient (`To`/`Cc`/`Bcc`) found");
    }

    const result: EmailOptions = {
        from,
        subject: map.get("subject") ?? "",
        to: to.length === 1 ? (to[0] as EmailAddress) : to,
    };

    if (cc.length > 0) {
        result.cc = cc.length === 1 ? cc[0] : cc;
    }

    if (bcc.length > 0) {
        result.bcc = bcc.length === 1 ? bcc[0] : bcc;
    }

    const replyTo = map.get("reply-to") ? parseAddress(map.get("reply-to") as string) : undefined;

    if (replyTo) {
        result.replyTo = replyTo;
    }

    const contentType = map.get("content-type");
    const boundary = getBoundary(contentType);

    // Walks a multipart body, recursing into nested multiparts (e.g. the
    // multipart/alternative wrapping text+html inside a multipart/mixed) and
    // mapping inline text/plain and text/html leaves back onto the result.
    const walkMultipart = (partBody: string, partBoundary: string): void => {
        for (const segment of partBody.split(`--${partBoundary}`)) {
            const trimmed = segment.replace(LEADING_NEWLINE_REGEX, "");

            // Skip the preamble/epilogue and the closing "--" delimiter.
            const isDelimiterOrEmpty = !trimmed || trimmed.startsWith("--");

            if (isDelimiterOrEmpty) {
                continue;
            }

            const { body: segmentBody, headers: segmentHeaders } = splitHeadersAndBody(trimmed);
            const segmentContentType = segmentHeaders.map.get("content-type") ?? "";
            const segmentEncoding = segmentHeaders.map.get("content-transfer-encoding");
            const disposition = segmentHeaders.map.get("content-disposition") ?? "";

            // Skip attachment parts; only inline text/html is mapped back.
            if (disposition.toLowerCase().includes("attachment")) {
                continue;
            }

            const nestedBoundary = getBoundary(segmentContentType);

            if (nestedBoundary && segmentContentType.toLowerCase().includes("multipart")) {
                walkMultipart(segmentBody, nestedBoundary);
            } else if (segmentContentType.toLowerCase().includes("text/plain")) {
                result.text = decodeBody(segmentBody.replace(TRAILING_NEWLINES_REGEX, ""), segmentEncoding);
            } else if (segmentContentType.toLowerCase().includes("text/html")) {
                result.html = decodeBody(segmentBody.replace(TRAILING_NEWLINES_REGEX, ""), segmentEncoding);
            }
        }
    };

    if (boundary && contentType?.toLowerCase().includes("multipart")) {
        walkMultipart(body, boundary);
    } else {
        const encoding = map.get("content-transfer-encoding");
        const decoded = decodeBody(body.replace(TRAILING_NEWLINE_REGEX, ""), encoding);

        if (contentType?.toLowerCase().includes("text/html")) {
            result.html = decoded;
        } else if (decoded) {
            result.text = decoded;
        }
    }

    // Carry over non-standard headers as custom headers.
    const knownHeaders = new Set(["bcc", "cc", "content-transfer-encoding", "content-type", "from", "mime-version", "reply-to", "subject", "to"]);
    const customHeaders: Record<string, string> = {};

    for (const [name, value] of headers.raw) {
        const lower = name.toLowerCase();

        if (lower === "x-priority" || lower === "importance") {
            if (HIGH_PRIORITY_REGEX.test(value)) {
                result.priority = "high";
            } else if (LOW_PRIORITY_REGEX.test(value)) {
                result.priority = "low";
            }
        }

        if (!knownHeaders.has(lower)) {
            customHeaders[name] = value;
        }
    }

    if (Object.keys(customHeaders).length > 0) {
        result.headers = customHeaders;
    }

    return result;
};

export default parseEml;
