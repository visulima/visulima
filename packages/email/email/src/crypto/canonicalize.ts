/**
 * RFC 6376 canonicalization, shared by the DKIM and ARC signers.
 *
 * Both sign the message **as transmitted**, so both need the same three things: a way to split a
 * serialized message, a header parser that understands folding, and the simple/relaxed
 * canonicalization pair. Keeping one copy means a spec fix lands for both — the two previously
 * drifted, and only one of them was right.
 */

/** A run of WSP — SP and HTAB, the only white space RFC 6376 collapses. */
const WSP_RUN = /[ \t]+/g;

/**
 * Strips leading and trailing WSP.
 *
 * Scanned rather than matched with an anchored regex: a header padded with a long run of spaces
 * makes `/^[ \t]+|[ \t]+$/` backtrack quadratically, and this runs on message data.
 * @param value The value to trim.
 * @returns The value without leading or trailing SP/HTAB.
 */
const trimWsp = (value: string): string => {
    let start = 0;
    let end = value.length;

    while (start < end && (value[start] === " " || value[start] === "\t")) {
        start += 1;
    }

    while (end > start && (value[end - 1] === " " || value[end - 1] === "\t")) {
        end -= 1;
    }

    return value.slice(start, end);
};

/** One logical header field, with folded continuation lines still attached to `raw`/`value`. */
export interface MimeHeader {
    /** Field name exactly as it appears in the message. */
    name: string;

    /** The complete field, `name: value`, including any folding. */
    raw: string;

    /** Everything after the first colon, including the leading space and any folding. */
    value: string;
}

/** Canonicalization method, per RFC 6376 §3.4. */
export type Canonicalization = "relaxed" | "simple";

/**
 * Splits a serialized message into its header block and body.
 *
 * Splits at the FIRST blank line only. A MIME body contains blank lines of its own (multipart
 * boundaries and part headers), so splitting on every CRLFCRLF would truncate it.
 * @param message The complete MIME message.
 * @returns The header block and the body, or `undefined` when there is no separator.
 */
export const splitMimeMessage = (message: string): { body: string; headersPart: string } | undefined => {
    const splitIndex = message.indexOf("\r\n\r\n");

    if (splitIndex === -1) {
        return undefined;
    }

    return { body: message.slice(splitIndex + 4), headersPart: message.slice(0, splitIndex) };
};

/**
 * Splits a MIME header block into logical fields, re-attaching folded continuation lines
 * (RFC 5322 §2.2.3) to the field they belong to.
 * @param headersPart The header block, without the terminating blank line.
 * @returns The parsed header fields in message order.
 */
export const parseMimeHeaders = (headersPart: string): MimeHeader[] => {
    const headers: MimeHeader[] = [];

    for (const line of headersPart.split("\r\n")) {
        const previous = headers.at(-1);

        if (previous !== undefined && (line.startsWith(" ") || line.startsWith("\t"))) {
            previous.raw += `\r\n${line}`;
            previous.value += `\r\n${line}`;

            continue;
        }

        const colon = line.indexOf(":");

        if (colon === -1) {
            continue;
        }

        headers.push({ name: line.slice(0, colon), raw: line, value: line.slice(colon + 1) });
    }

    return headers;
};

/**
 * Canonicalizes a message body per RFC 6376 §3.4.3 (simple) or §3.4.4 (relaxed).
 *
 * Both forms drop trailing empty lines and terminate with CRLF. They differ on the empty body:
 * simple canonicalizes it to a single CRLF, relaxed to nothing at all. Neither translates line
 * endings — the body is hashed as transmitted.
 * @param body The message body, taken verbatim from the transmitted message.
 * @param method The canonicalization method.
 * @returns The canonicalized body.
 */
export const canonicalizeBody = (body: string, method: Canonicalization): string => {
    // Split on CRLF only. RFC 6376 canonicalizes the octets as transmitted — it does not translate
    // line endings — so normalizing bare LFs here would hash a body that was never sent.
    // `buildMimeMessage` guarantees CRLF throughout; a caller passing something else gets the
    // bytes they actually handed us.
    const lines = body.split("\r\n");

    if (method === "relaxed") {
        for (const [index, line] of lines.entries()) {
            // §3.4.4: collapse each WSP run to a single SP, then drop the trailing WSP. The
            // collapse leaves at most one trailing space, so no second scan is needed.
            const collapsed = line.replaceAll(WSP_RUN, " ");

            lines[index] = collapsed.endsWith(" ") ? collapsed.slice(0, -1) : collapsed;
        }
    }

    let end = lines.length;

    while (end > 0 && lines[end - 1] === "") {
        end -= 1;
    }

    if (end === 0) {
        return method === "simple" ? "\r\n" : "";
    }

    return `${lines.slice(0, end).join("\r\n")}\r\n`;
};

/**
 * Canonicalizes a single header field per RFC 6376 §3.4.1 (simple) or §3.4.2 (relaxed).
 *
 * Simple leaves the field byte-identical to the message. Relaxed lowercases the name, unfolds the
 * value, collapses whitespace runs to a single SP and trims the ends.
 * @param name The field name.
 * @param value Everything after the colon, folding intact.
 * @param method The canonicalization method.
 * @returns The canonicalized field, without a trailing CRLF.
 */
export const canonicalizeHeader = (name: string, value: string, method: Canonicalization): string => {
    if (method === "simple") {
        return `${name}:${value}`;
    }

    // §3.4.2 operates on WSP — SP and HTAB — not on the wider set `\s`/`trim()` match. A verifier
    // preserves a non-breaking space, vertical tab or form feed byte-for-byte, so collapsing one
    // here would hash a header the recipient never sees. Unfold first (delete the CRLF of each
    // continuation line), then collapse and trim WSP only.
    const collapsed = value.replaceAll("\r\n", "").replaceAll(WSP_RUN, " ");

    return `${trimWsp(name.toLowerCase())}:${trimWsp(collapsed)}`;
};

/**
 * Orders the fields a signature covers, honouring RFC 6376 §5.4.2 for repeated names.
 *
 * When `h=` names a field more than once the instances are taken from the bottom of the header
 * block upward. `buildMimeMessage` really can emit a duplicate — a caller passing both `replyTo`
 * and a `Reply-To` in `headers` gets two — and signing them top-down produces a signature no
 * verifier can reproduce. Only repeated names are reordered, so the ordinary single-instance case
 * keeps message order.
 * @param candidates The fields to sign, in message order.
 * @returns The same fields, with repeated names in bottom-up instance order.
 */
export const orderSignedHeaders = (candidates: MimeHeader[]): MimeHeader[] => {
    const instancesByName = new Map<string, MimeHeader[]>();

    for (const header of candidates) {
        const lower = header.name.toLowerCase();

        instancesByName.set(lower, [...instancesByName.get(lower) ?? [], header]);
    }

    const takenPerName = new Map<string, number>();

    return candidates.map((header) => {
        const lower = header.name.toLowerCase();
        const instances = instancesByName.get(lower) as MimeHeader[];
        const taken = takenPerName.get(lower) ?? 0;

        takenPerName.set(lower, taken + 1);

        return instances[instances.length - 1 - taken] as MimeHeader;
    });
};
