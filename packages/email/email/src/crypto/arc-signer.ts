import { createHash, createPrivateKey, createSign } from "node:crypto";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readFile } from "@visulima/fs";

import type { EmailAddress, EmailOptions } from "../types";
import headersToRecord from "../utils/headers-to-record";

const WHITESPACE_RUN = /\s+/g;
const TRAILING_SPACE = / $/;

/**
 * Default headers signed by the ARC-Message-Signature when none are specified.
 */
const DEFAULT_SIGNED_HEADERS = ["from", "to", "cc", "subject", "date", "message-id", "mime-version"];

/**
 * Options for {@link signArc}.
 */
interface ArcSealOptions {
    /**
     * The `Authentication-Results` value to chain (authserv-id plus method results),
     * e.g. `example.com; spf=pass smtp.mailfrom=...; dkim=pass header.d=...`.
     */
    authenticationResults: string;

    /**
     * Chain validation status for the seal (`cv`). For an originating sealer (instance 1) this is
     * always `none`.
     * @default "none"
     */
    cv?: "fail" | "none" | "pass";

    /**
     * The signing domain (`d`).
     */
    domainName: string;

    /**
     * Lower-cased header names covered by the ARC-Message-Signature (`h`).
     * @default from, to, cc, subject, date, message-id, mime-version
     */
    headersToSign?: string[];

    /**
     * The ARC instance number (`i`). Only `1` (originating sealer) is supported.
     * @default 1
     */
    instance?: number;

    /**
     * The DKIM/ARC key selector (`s`).
     */
    keySelector: string;

    /**
     * Passphrase for an encrypted private key.
     */
    passphrase?: string;

    /**
     * RSA private key (PEM string, or a `file://` path).
     */
    privateKey: string;

    /**
     * Signature timestamp (`t`) in unix seconds. Defaults to now.
     */
    timestamp?: number;
}

/**
 * The three ARC header fields produced for one instance.
 */
interface ArcHeaderSet {
    "ARC-Authentication-Results": string;
    "ARC-Message-Signature": string;
    "ARC-Seal": string;
}

const formatAddress = (address: EmailAddress): string => {
    if (address.name) {
        return `${address.name} <${address.email}>`;
    }

    return address.email;
};

const formatAddresses = (addresses: EmailAddress | EmailAddress[]): string => {
    const list = Array.isArray(addresses) ? addresses : [addresses];

    return list.map((address) => formatAddress(address)).join(", ");
};

/**
 * RFC 6376 "relaxed" canonicalization of a single header field.
 * @param name The header field name.
 * @param value The header field value.
 * @returns The canonicalized `name:value` line.
 */
const relaxedHeader = (name: string, value: string): string => `${name.toLowerCase()}:${value.replaceAll(WHITESPACE_RUN, " ").trim()}`;

/**
 * RFC 6376 "relaxed" body canonicalization.
 * @param body The message body.
 * @returns The canonicalized body.
 */
const relaxedBody = (body: string): string => {
    const lines = body.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
    const processed = lines.map((line) => line.replaceAll(WHITESPACE_RUN, " ").replace(TRAILING_SPACE, ""));

    let text = processed.join("\r\n");

    while (text.endsWith("\r\n")) {
        text = text.slice(0, -2);
    }

    return text.length > 0 ? `${text}\r\n` : "";
};

/**
 * Builds the signable header map (well-known fields plus any caller headers).
 * @param email The email being sealed.
 * @returns The header record.
 */
const buildHeaders = (email: EmailOptions): Record<string, string> => {
    const headers: Record<string, string> = {
        ...email.headers ? headersToRecord(email.headers) : {},
        From: formatAddresses(email.from),
        Subject: email.subject,
        To: formatAddresses(email.to),
    };

    if (email.cc) {
        headers.Cc = formatAddresses(email.cc);
    }

    headers["MIME-Version"] ??= "1.0";

    return headers;
};

/**
 * Computes the exact byte string that the ARC-Message-Signature `b=` value signs.
 *
 * Exposed so ARC verifiers (and tests) can re-derive the signing input.
 * @param email The email being sealed.
 * @param options The seal options.
 * @returns The AMS header (without the `b=` value) and the data signed.
 */
const arcMessageSignatureBase = (email: EmailOptions, options: ArcSealOptions): { header: string; signBase: string } => {
    const instance = options.instance ?? 1;
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    const headers = buildHeaders(email);

    // Only sign headers that are actually present with a non-empty value: a name in h= whose value
    // canonicalizes to empty would break verification, and we do not synthesize Date/Message-ID.
    const signedHeaderNames = (options.headersToSign ?? DEFAULT_SIGNED_HEADERS).filter((name) => {
        const key = Object.keys(headers).find((header) => header.toLowerCase() === name);

        return key !== undefined && headers[key] !== undefined && headers[key] !== "";
    });

    const body = [email.text, email.html].filter((part): part is string => part !== undefined).join("\n\n");
    const bodyHash = createHash("sha256").update(relaxedBody(body)).digest("base64");

    const headerValue = [
        `i=${String(instance)}`,
        "a=rsa-sha256",
        "c=relaxed/relaxed",
        `d=${options.domainName}`,
        `s=${options.keySelector}`,
        `t=${String(timestamp)}`,
        `h=${signedHeaderNames.join(":")}`,
        `bh=${bodyHash}`,
        "b=",
    ].join("; ");

    const canonicalizedHeaders = signedHeaderNames
        .map((name) => {
            const key = Object.keys(headers).find((header) => header.toLowerCase() === name) as string;

            return relaxedHeader(name, headers[key] ?? "");
        })
        .join("\r\n");

    // The AMS header itself is included with a trailing (empty) b= and no trailing CRLF.
    const signBase = `${canonicalizedHeaders}\r\n${relaxedHeader("ARC-Message-Signature", headerValue)}`;

    return { header: headerValue, signBase };
};

/**
 * Computes the exact byte string that the ARC-Seal `b=` value signs (for an originating, i=1 seal).
 *
 * Exposed so ARC verifiers (and tests) can re-derive the signing input.
 * @param aarValue The ARC-Authentication-Results value.
 * @param amsValue The full ARC-Message-Signature value (including its `b=` signature).
 * @param options The signing domain, selector, instance, timestamp and chain-validation status.
 * @returns The ARC-Seal header (without the `b=` value) and the data signed.
 */
const arcSealBase = (aarValue: string, amsValue: string, options: ArcSealOptions): { header: string; signBase: string } => {
    const instance = options.instance ?? 1;
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    const cv = options.cv ?? "none";

    const headerValue = [
        `i=${String(instance)}`,
        "a=rsa-sha256",
        `cv=${cv}`,
        `d=${options.domainName}`,
        `s=${options.keySelector}`,
        `t=${String(timestamp)}`,
        "b=",
    ].join("; ");

    const signBase = [
        relaxedHeader("ARC-Authentication-Results", aarValue),
        relaxedHeader("ARC-Message-Signature", amsValue),
        relaxedHeader("ARC-Seal", headerValue),
    ].join("\r\n");

    return { header: headerValue, signBase };
};

const loadPrivateKey = async (privateKey: string, passphrase?: string) => {
    let content = privateKey;

    if (content.startsWith("file://")) {
        content = await readFile(content.slice("file://".length), { encoding: "utf8" });
    }

    return createPrivateKey({ key: content, passphrase });
};

/**
 * Seals a message with an ARC (Authenticated Received Chain, RFC 8617) header set for an originating
 * sealer (instance `i=1`).
 *
 * Adds `ARC-Authentication-Results`, `ARC-Message-Signature`, and `ARC-Seal` headers. Use this when
 * your service forwards mail and wants downstream receivers to trust the authentication results you
 * observed.
 * @param email The email to seal.
 * @param options The seal options. See {@link ArcSealOptions}.
 * @returns The email with the ARC header set added, and the raw {@link ArcHeaderSet}.
 * @throws {Error} When the private key cannot be loaded or signing fails.
 */
const signArc = async (email: EmailOptions, options: ArcSealOptions): Promise<{ email: EmailOptions; headers: ArcHeaderSet }> => {
    const instance = options.instance ?? 1;
    // Resolve the timestamp once so the AMS and ARC-Seal share an identical t= value.
    const sealOptions: ArcSealOptions = { ...options, timestamp: options.timestamp ?? Math.floor(Date.now() / 1000) };
    const key = await loadPrivateKey(options.privateKey, options.passphrase);

    const aarValue = `i=${String(instance)}; ${options.authenticationResults}`;

    const ams = arcMessageSignatureBase(email, sealOptions);
    const amsSignature = createSign("RSA-SHA256").update(ams.signBase).sign(key, "base64");
    const amsValue = `${ams.header}${amsSignature}`;

    const seal = arcSealBase(aarValue, amsValue, sealOptions);
    const sealSignature = createSign("RSA-SHA256").update(seal.signBase).sign(key, "base64");
    const sealValue = `${seal.header}${sealSignature}`;

    const headers: ArcHeaderSet = {
        "ARC-Authentication-Results": aarValue,
        "ARC-Message-Signature": amsValue,
        "ARC-Seal": sealValue,
    };

    return {
        email: {
            ...email,
            headers: { ...email.headers ? headersToRecord(email.headers) : {}, ...headers },
        },
        headers,
    };
};

export type { ArcHeaderSet, ArcSealOptions };
export { arcMessageSignatureBase, arcSealBase, signArc };
