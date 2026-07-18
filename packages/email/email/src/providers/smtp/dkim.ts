import { createHash, createSign } from "node:crypto";

/**
 * DKIM signing parameters.
 */
export interface DkimSignOptions {
    domainName: string;
    keySelector: string;
    privateKey: string;
}

/**
 * RFC 6376 §3.4.4 relaxed body canonicalization: normalize line endings,
 * reduce whitespace runs within a line to a single SP, strip trailing
 * whitespace per line, drop trailing empty lines, and terminate with CRLF.
 * @param body The message body to canonicalize.
 * @returns The canonicalized body.
 */
export const canonicalizeBody = (body: string): string => {
    const lines = body
        .replaceAll("\r\n", "\n")
        .split("\n")
        // eslint-disable-next-line e18e/prefer-static-regex, sonarjs/slow-regex
        .map((line) => line.replaceAll(/[ \t]+/g, " ").replace(/ +$/, ""));

    let end = lines.length;

    while (end > 0 && lines[end - 1] === "") {
        end -= 1;
    }

    return end > 0 ? `${lines.slice(0, end).join("\r\n")}\r\n` : "";
};

/**
 * RFC 6376 §3.4.2 relaxed header canonicalization: lowercase the field
 * name, unfold, reduce internal whitespace to a single SP, and strip
 * leading/trailing whitespace around the value.
 * @param header The header line to canonicalize.
 * @returns The canonicalized header.
 */
export const canonicalizeHeader = (header: string): string => {
    const colon = header.indexOf(":");

    if (colon === -1) {
        return `${header.toLowerCase().trim()}:`;
    }

    const name = header.slice(0, colon).toLowerCase().trim();
    const value = header.slice(colon + 1).replaceAll(/\s+/g, " ").trim();

    return `${name}:${value}`;
};

/**
 * Signs a MIME message with DKIM using RFC 6376 relaxed/relaxed canonicalization.
 * @param message The full MIME message (headers + body separated by a blank line).
 * @param dkim The DKIM signing parameters.
 * @returns The signed message with a prepended DKIM-Signature header, or the
 * original message when it has no header/body separator.
 */
export const signMessageWithDkim = (message: string, dkim: DkimSignOptions): string => {
    const { domainName, keySelector, privateKey } = dkim;

    // Separate headers from the body at the FIRST blank line only. The body
    // itself contains blank lines (multipart boundaries and part headers), so
    // a naive split("\r\n\r\n") would truncate everything after the first part.
    const splitIndex = message.indexOf("\r\n\r\n");

    if (splitIndex === -1) {
        return message;
    }

    const headersPart = message.slice(0, splitIndex);
    const bodyPart = message.slice(splitIndex + 4);

    const headers = headersPart.split("\r\n");

    const canonicalizedBody = canonicalizeBody(bodyPart);
    const bodyHash = createHash("sha256").update(canonicalizedBody).digest("base64");

    // Find which headers to sign (from, to, subject, date)
    const headerNames = ["from", "to", "subject", "date"];
    const headersToSign = headers.filter((h) => headerNames.some((n) => h.toLowerCase().startsWith(`${n}:`)));
    const dkimHeaderList = headersToSign
        .map((h) => {
            const parts = h.split(":");

            return parts[0]?.toLowerCase() ?? "";
        })
        .filter(Boolean)
        .join(":");

    // Build DKIM header (without signature)
    const now = Math.floor(Date.now() / 1000);
    const dkimFields = {
        a: "rsa-sha256",
        bh: bodyHash,
        c: "relaxed/relaxed",
        d: domainName,
        h: dkimHeaderList,
        s: keySelector,
        t: now.toString(),
        v: "1",
    };
    const dkimHeader = `DKIM-Signature: ${Object.entries(dkimFields)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")}; b=`;

    // Canonicalize the signed headers followed by the DKIM-Signature header
    // (with an empty b= value and no trailing CRLF, per RFC 6376 §3.7).
    const headersForSign = [...headersToSign, dkimHeader].map((header) => canonicalizeHeader(header)).join("\r\n");
    const signer = createSign("RSA-SHA256");

    signer.update(headersForSign);
    const signature = signer.sign(privateKey, "base64");
    const finalDkimHeader = `${dkimHeader}${signature}`;

    // Prepend the DKIM-Signature header, preserving all original headers and
    // the complete body (including the closing multipart boundary).
    return `${finalDkimHeader}\r\n${headers.join("\r\n")}\r\n\r\n${bodyPart}`;
};
