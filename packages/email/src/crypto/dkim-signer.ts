import { createHash, createPrivateKey, createSign } from "node:crypto";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readFile } from "@visulima/fs";

import type { EmailOptions } from "../types";
import headersToRecord from "../utils/headers-to-record";
import type { DkimOptions, EmailSigner } from "./types";

/**
 * Canonicalizes headers according to DKIM specification.
 * @param headers The headers to canonicalize.
 * @param method The canonicalization method ('simple' or 'relaxed').
 * @returns The canonicalized header string.
 */
const canonicalizeHeaders = (headers: Record<string, string>, method: "simple" | "relaxed" = "simple"): string => {
    const headerLines: string[] = [];

    for (const [key, value] of Object.entries(headers)) {
        const normalizedKey = method === "relaxed" ? key.toLowerCase().trim() : key;
        const normalizedValue = method === "relaxed" ? value.replaceAll(/\s+/g, " ").trim() : value;

        headerLines.push(`${normalizedKey}:${normalizedValue}`);
    }

    return headerLines.join("\r\n");
};

/**
 * Canonicalizes body according to DKIM specification.
 * @param body The email body to canonicalize.
 * @param method The canonicalization method ('simple' or 'relaxed').
 * @returns The canonicalized body string.
 */
const canonicalizeBody = (body: string, method: "simple" | "relaxed" = "simple"): string => {
    if (method === "simple") {
        // Simple: Remove empty lines (consecutive CRLFs) at the end, but preserve the CRLF
        // that terminates the last line of actual content. If no trailing CRLF, add one.
        const normalized = body.replace(/(\r\n|\r|\n)$/, "\n");
        // eslint-disable-next-line sonarjs/slow-regex -- Anchored pattern, safe from backtracking
        const trimmed = normalized.replace(/\n+$/, "");

        return trimmed ? `${trimmed}\n` : "\n";
    }

    // Relaxed: Normalize line endings, reduce whitespace sequences, remove trailing whitespace
    // per line, remove empty lines at end, but preserve indentation (leading whitespace)
    let normalized = body.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

    // Process each line: reduce whitespace sequences to single space, remove trailing whitespace
    const lines = normalized.split("\n");
    const processedLines = lines.map((line) => {
        // Reduce sequences of whitespace within a line to a single space
        // Processing line-by-line limits input size, preventing DoS
        const normalizedLine = line.replaceAll(/\s+/g, " ");

        // Remove trailing whitespace (but preserve the line itself)
        // eslint-disable-next-line sonarjs/slow-regex -- Anchored pattern, safe from backtracking
        return normalizedLine.replace(/[ \t]+$/, "");
    });

    normalized = processedLines.join("\n");

    // Remove empty lines at the end, but ensure there's at least one \n at the end
    // eslint-disable-next-line sonarjs/slow-regex -- Anchored pattern, safe from backtracking
    const trimmed = normalized.replace(/\n+$/, "");

    return trimmed ? `${trimmed}\n` : "\n";
};

/**
 * Creates DKIM signature header value (without the signature itself).
 * @param headers The email headers.
 * @param options DKIM signing options.
 * @param bodyHash The base64-encoded body hash.
 * @returns The DKIM signature header string (without the signature value).
 */
const createDkimSignatureHeader = (headers: Record<string, string>, options: DkimOptions, bodyHash: string): string => {
    const headerCanon = options.headerCanon || "simple";
    const bodyCanon = options.bodyCanon || "simple";
    const headersToSign = Object.keys(headers)
        .filter((h) => !options.headersToIgnore?.some((ignore) => ignore.toLowerCase() === h.toLowerCase()))
        .map((h) => h.toLowerCase())
        .join(":");

    const dkimHeader = [
        `v=1`,
        `a=rsa-sha256`,
        `c=${headerCanon}/${bodyCanon}`,
        `d=${options.domainName}`,
        `s=${options.keySelector}`,
        `h=${headersToSign}`,
        `bh=${bodyHash}`,
        `b=`,
    ].join("; ");

    return dkimHeader;
};

/**
 * DKIM signer implementation
 */
export class DkimSigner implements EmailSigner {
    /**
     * Formats an email address for use in email headers.
     * @param address The email address object to format.
     * @param address.email The email address string.
     * @param address.name Optional display name for the email address.
     * @returns The formatted email address string in RFC 5322 format.
     */
    private static formatAddress(address: { email: string; name?: string }): string {
        if (address.name) {
            return `"${address.name}" <${address.email}>`;
        }

        return address.email;
    }

    /**
     * Formats email addresses for headers.
     * @param addresses The email address(es) to format (single or array).
     * @returns The formatted email addresses string (comma-separated if multiple).
     */
    private static formatAddresses(addresses: { email: string; name?: string } | { email: string; name?: string }[]): string {
        const addressArray = Array.isArray(addresses) ? addresses : [addresses];

        return addressArray.map((addr) => DkimSigner.formatAddress(addr)).join(", ");
    }

    private readonly options: DkimOptions;

    /**
     * Creates a new DKIM signer.
     * @param options DKIM signing options.
     */
    public constructor(options: DkimOptions) {
        this.options = options;
    }

    /**
     * Signs an email message with DKIM.
     * @param email The email options to sign.
     * @returns The email options with DKIM signature header added.
     * @throws {Error} When signing fails (e.g., invalid private key).
     */
    public async sign(email: EmailOptions): Promise<EmailOptions> {
        let privateKeyContent = this.options.privateKey;

        if (privateKeyContent.startsWith("file://")) {
            const filePath = privateKeyContent.slice(7);

            privateKeyContent = await readFile(filePath, { encoding: "utf8" });
        }

        const headers: Record<string, string> = {
            ...email.headers ? headersToRecord(email.headers) : {},
            From: DkimSigner.formatAddress(email.from),
            To: DkimSigner.formatAddresses(email.to),
        };

        if (email.cc) {
            headers.Cc = DkimSigner.formatAddresses(email.cc);
        }

        if (email.replyTo) {
            headers["Reply-To"] = DkimSigner.formatAddress(email.replyTo);
        }

        headers.Subject = email.subject;
        headers["MIME-Version"] = "1.0";

        const bodyParts: string[] = [];

        if (email.text) {
            bodyParts.push(email.text);
        }

        if (email.html) {
            bodyParts.push(email.html);
        }

        const body = bodyParts.join("\n\n");

        const headerCanon = this.options.headerCanon || "simple";
        const bodyCanon = this.options.bodyCanon || "simple";
        const canonicalHeaders = canonicalizeHeaders(headers, headerCanon);
        const canonicalBody = canonicalizeBody(body, bodyCanon);

        const bodyHash = createHash("sha256").update(canonicalBody).digest("base64");

        const dkimSignatureHeader = createDkimSignatureHeader(headers, this.options, bodyHash);

        const signData = `${canonicalHeaders}\r\nDKIM-Signature: ${dkimSignatureHeader}`;
        const signer = createSign("RSA-SHA256");

        signer.update(signData);

        let signature: string;

        try {
            const key = createPrivateKey({
                key: privateKeyContent,
                passphrase: this.options.passphrase,
            });

            signature = signer.sign(key, "base64");
        } catch (error) {
            throw new Error(`Failed to create DKIM signature: ${(error as Error).message}`);
        }

        const formattedSignature = signature.match(/.{1,72}/g)?.join("\r\n ") || signature;

        const signedHeaders = {
            ...headers,
            "DKIM-Signature": `${dkimSignatureHeader}${formattedSignature}`,
        };

        return {
            ...email,
            headers: signedHeaders,
        };
    }
}

/**
 * Creates a DKIM signer instance.
 * @param options DKIM signing options.
 * @returns A new DkimSigner instance.
 */
export const createDkimSigner = (options: DkimOptions): DkimSigner => new DkimSigner(options);
