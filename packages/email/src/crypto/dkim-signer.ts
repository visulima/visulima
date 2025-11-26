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
        // Simple: remove trailing CRLF sequences
        return body.replace(/\r\n$/, "").replace(/\n$/, "");
    }

    // Relaxed: normalize whitespace
    // eslint-disable-next-line sonarjs/slow-regex
    return body.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll(/\s+\n/g, "\n").replaceAll(/\n\s+/g, "\n").replace(/\n+$/, "\n");
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
        .filter((h) => !options.headersToIgnore?.includes(h))
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
        // Load private key
        let privateKeyContent = this.options.privateKey;

        if (privateKeyContent.startsWith("file://")) {
            const filePath = privateKeyContent.slice(7);

            privateKeyContent = await readFile(filePath, { encoding: "utf8" });
        }

        // Build the email message for signing
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

        // Build body
        const bodyParts: string[] = [];

        if (email.text) {
            bodyParts.push(email.text);
        }

        if (email.html) {
            bodyParts.push(email.html);
        }

        const body = bodyParts.join("\n\n");

        // Canonicalize headers and body
        const headerCanon = this.options.headerCanon || "simple";
        const bodyCanon = this.options.bodyCanon || "simple";
        const canonicalHeaders = canonicalizeHeaders(headers, headerCanon);
        const canonicalBody = canonicalizeBody(body, bodyCanon);

        // Create body hash
        const bodyHash = createHash("sha256").update(canonicalBody).digest("base64");

        // Create DKIM-Signature header (without signature value)
        const dkimSignatureHeader = createDkimSignatureHeader(headers, this.options, bodyHash);

        // Sign the header
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

        // Format signature with proper line breaks (DKIM spec allows folding)
        // The signature can be split into multiple lines with whitespace for readability
        const formattedSignature = signature.match(/.{1,72}/g)?.join("\r\n ") || signature;

        // Add DKIM signature to headers
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
