import { Buffer } from "node:buffer";
import type { KeyObject } from "node:crypto";
import { createHash, createPrivateKey, createPublicKey, createSign, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";

// eslint-disable-next-line import/no-extraneous-dependencies
import { readFile } from "@visulima/fs";

import type { EmailOptions } from "../types";
import headersToRecord from "../utils/headers-to-record";
import { formatAddresses } from "./format-address";

const WHITESPACE_RUN = /\s+/g;
const TRAILING_SPACE = / $/;
const AAR_INSTANCE = /^\s*i=(\d+)\s*;/;

/**
 * Default headers signed by the ARC-Message-Signature when none are specified.
 */
const DEFAULT_SIGNED_HEADERS = ["from", "to", "cc", "subject", "date", "message-id", "mime-version"];

/**
 * The signature algorithm for the ARC headers. RSA per RFC 8617, Ed25519 per RFC 8463.
 */
type ArcAlgorithm = "ed25519-sha256" | "rsa-sha256";

/**
 * Options for {@link signArc}.
 */
interface ArcSealOptions {
    /**
     * Signature algorithm (`a=`). `rsa-sha256` (default) or `ed25519-sha256` (RFC 8463).
     * @default "rsa-sha256"
     */
    algorithm?: ArcAlgorithm;

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
     * Private key (PEM string, or a `file://` path). RSA or Ed25519 to match `algorithm`.
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

/**
 * Options for {@link verifyArc}.
 */
interface ArcVerifyOptions {
    /**
     * The ARC/DKIM public key for the signing domain+selector — a PEM string or a `KeyObject`. Look it
     * up at `&lt;selector>._domainkey.&lt;d>` (the `p=` tag), decoded to SPKI.
     */
    publicKey: KeyObject | string;
}

/**
 * The outcome of {@link verifyArc}.
 */
interface ArcVerifyResult {
    /**
     * Per-component verification: the ARC-Message-Signature, the ARC-Seal, and the body hash.
     */
    components: { ams: boolean; bodyHash: boolean; seal: boolean };

    /**
     * The chain-validation status (`cv`) from the ARC-Seal.
     */
    cv?: string;

    /**
     * A machine-readable reason when `valid` is `false`.
     */
    reason?: string;

    /**
     * Whether the whole instance verified (signature + seal + body hash).
     */
    valid: boolean;
}

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

    // RFC 6376 relaxed body canonicalization: an empty body still hashes as a single CRLF.
    return text.length > 0 ? `${text}\r\n` : "\r\n";
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
 * Parses a DKIM/ARC tag string (`k=v; k2=v2`) into a record of trimmed tag values.
 * @param value The tag string.
 * @returns The parsed tags keyed by name.
 */
const parseArcTags = (value: string): Record<string, string> => {
    const tags: Record<string, string> = {};

    for (const part of value.split(";")) {
        const index = part.indexOf("=");

        if (index !== -1) {
            tags[part.slice(0, index).trim()] = part.slice(index + 1).trim();
        }
    }

    return tags;
};

/**
 * Returns the header value up to and including the empty `b=` tag (the bytes that are signed).
 * @param headerValue The full ARC header value.
 * @returns The value with the `b=` signature removed.
 */
const stripSignature = (headerValue: string): string => {
    const index = headerValue.lastIndexOf("b=");

    return index === -1 ? headerValue : headerValue.slice(0, index + 2);
};

/**
 * Computes the body hash for the message, matching the signer (relaxed canonicalization of
 * `text` + "\n\n" + `html`).
 * @param email The email whose body to hash.
 * @returns The base64 SHA-256 body hash.
 */
const bodyHashOf = (email: EmailOptions): string => {
    const body = [email.text, email.html].filter((part): part is string => part !== undefined).join("\n\n");

    return createHash("sha256").update(relaxedBody(body)).digest("base64");
};

const signData = (data: string, key: KeyObject, algorithm: ArcAlgorithm): string => {
    if (algorithm === "ed25519-sha256") {
        // RFC 8463: Ed25519 signs the SHA-256 digest of the data. node requires `null` as the algorithm.
        // eslint-disable-next-line unicorn/no-null
        return cryptoSign(null, createHash("sha256").update(data).digest(), key).toString("base64");
    }

    return createSign("RSA-SHA256").update(data).sign(key, "base64");
};

const verifyData = (data: string, signature: string, key: KeyObject, algorithm: ArcAlgorithm): boolean => {
    const signatureBytes = Buffer.from(signature, "base64");

    try {
        if (algorithm === "ed25519-sha256") {
            // eslint-disable-next-line unicorn/no-null
            return cryptoVerify(null, createHash("sha256").update(data).digest(), key, signatureBytes);
        }

        return cryptoVerify("RSA-SHA256", Buffer.from(data), key, signatureBytes);
    } catch {
        return false;
    }
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
    const algorithm = options.algorithm ?? "rsa-sha256";
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    const headers = buildHeaders(email);

    // Only sign headers that are actually present with a non-empty value: a name in h= whose value
    // canonicalizes to empty would break verification, and we do not synthesize Date/Message-ID.
    const signedHeaderNames = (options.headersToSign ?? DEFAULT_SIGNED_HEADERS).filter((name) => {
        const key = Object.keys(headers).find((header) => header.toLowerCase() === name);

        return key !== undefined && headers[key] !== undefined && headers[key] !== "";
    });

    const headerValue = [
        `i=${String(instance)}`,
        `a=${algorithm}`,
        "c=relaxed/relaxed",
        `d=${options.domainName}`,
        `s=${options.keySelector}`,
        `t=${String(timestamp)}`,
        `h=${signedHeaderNames.join(":")}`,
        `bh=${bodyHashOf(email)}`,
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
    const algorithm = options.algorithm ?? "rsa-sha256";
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    const cv = options.cv ?? "none";

    const headerValue = [
        `i=${String(instance)}`,
        `a=${algorithm}`,
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

const loadPrivateKey = async (privateKey: string, passphrase?: string): Promise<KeyObject> => {
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
 * observed. Supports RSA (default) and Ed25519 (`algorithm: "ed25519-sha256"`, RFC 8463) keys.
 *
 * IMPORTANT: the body hash (`bh=`) is computed over `text` + "\n\n" + `html` with relaxed
 * canonicalization — the same simplification as the DKIM signer. For a third-party ARC verifier to
 * accept the seal, the body actually transmitted on the wire must canonicalize to this same value, so
 * apply ARC at the point where the MIME body is finalized (or feed in the exact rendered body).
 * @param email The email to seal.
 * @param options The seal options. See {@link ArcSealOptions}.
 * @returns The email with the ARC header set added, and the raw {@link ArcHeaderSet}.
 * @throws {Error} When the private key cannot be loaded or signing fails.
 */
const signArc = async (email: EmailOptions, options: ArcSealOptions): Promise<{ email: EmailOptions; headers: ArcHeaderSet }> => {
    const instance = options.instance ?? 1;
    const cv = options.cv ?? "none";

    if (instance !== 1) {
        // Only the originating sealer is supported; a higher instance has no prior chain to seal and
        // would emit a structurally invalid set (cv=none with i>1) rather than failing fast.
        throw new Error(`signArc only supports an originating sealer (instance 1); received i=${String(instance)}`);
    }

    if (cv !== "none") {
        // An originating seal is always cv=none; a non-none value would produce a seal our own
        // verifyArc() rejects, contradicting the documented contract.
        throw new Error(`signArc only supports cv=none for an originating sealer; received cv=${cv}`);
    }

    const algorithm = options.algorithm ?? "rsa-sha256";
    // Resolve the timestamp once so the AMS and ARC-Seal share an identical t= value.
    const sealOptions: ArcSealOptions = { ...options, cv: "none", timestamp: options.timestamp ?? Math.floor(Date.now() / 1000) };
    const key = await loadPrivateKey(options.privateKey, options.passphrase);

    const aarValue = `i=${String(instance)}; ${options.authenticationResults}`;

    const ams = arcMessageSignatureBase(email, sealOptions);
    const amsValue = `${ams.header}${signData(ams.signBase, key, algorithm)}`;

    const seal = arcSealBase(aarValue, amsValue, sealOptions);
    const sealValue = `${seal.header}${signData(seal.signBase, key, algorithm)}`;

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

/**
 * Verifies an originating (i=1) ARC header set against the signing domain's public key.
 *
 * Re-derives the AMS and ARC-Seal signing inputs from `email` + the supplied ARC headers, recomputes
 * the body hash, and checks all three. The public key must be the one published for the seal's
 * `s=`/`d=` (the DKIM-style `&lt;selector>._domainkey.&lt;domain>` TXT `p=` value).
 * @param email The message that was sealed (same fields used when signing).
 * @param headers The ARC header set (or any record containing the three `ARC-*` headers).
 * @param options Verification options. See {@link ArcVerifyOptions}.
 * @returns The verification result. See {@link ArcVerifyResult}.
 */
const verifyArc = (email: EmailOptions, headers: ArcHeaderSet | Record<string, string>, options: ArcVerifyOptions): ArcVerifyResult => {
    const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])) as Record<string, string>;
    const amsValue = lower["arc-message-signature"];
    const sealValue = lower["arc-seal"];
    const aarValue = lower["arc-authentication-results"];

    if (!amsValue || !sealValue || !aarValue) {
        return { components: { ams: false, bodyHash: false, seal: false }, reason: "missing-arc-headers", valid: false };
    }

    let publicKey: KeyObject;

    try {
        publicKey = typeof options.publicKey === "string" ? createPublicKey(options.publicKey) : options.publicKey;
    } catch {
        return { components: { ams: false, bodyHash: false, seal: false }, reason: "invalid-public-key", valid: false };
    }

    const amsTags = parseArcTags(amsValue);
    const sealTags = parseArcTags(sealValue);
    const aarInstance = AAR_INSTANCE.exec(aarValue)?.[1];

    // This verifier only covers an originating (i=1) seal with cv=none; reject any other shape so
    // result.valid never claims more than the documented contract.
    if (aarInstance !== "1" || amsTags.i !== "1" || sealTags.i !== "1" || sealTags.cv !== "none") {
        return { components: { ams: false, bodyHash: false, seal: false }, cv: sealTags.cv, reason: "unsupported-arc-instance", valid: false };
    }

    const amsAlgorithm: ArcAlgorithm = amsTags.a === "ed25519-sha256" ? "ed25519-sha256" : "rsa-sha256";
    const sealAlgorithm: ArcAlgorithm = sealTags.a === "ed25519-sha256" ? "ed25519-sha256" : "rsa-sha256";

    // Body hash: recompute and compare to the bh= tag.
    const bodyHash = amsTags.bh !== undefined && amsTags.bh === bodyHashOf(email);

    // ARC-Message-Signature: canonicalize the h= headers + the AMS header with an emptied b=.
    const messageHeaders = buildHeaders(email);
    const signedNames = (amsTags.h ?? "").split(":").map((name) => name.trim().toLowerCase()).filter(Boolean);
    const canonicalizedHeaders = signedNames
        .map((name) => {
            const key = Object.keys(messageHeaders).find((header) => header.toLowerCase() === name);

            return relaxedHeader(name, key ? messageHeaders[key] ?? "" : "");
        })
        .join("\r\n");
    const amsSignBase = `${canonicalizedHeaders}\r\n${relaxedHeader("ARC-Message-Signature", stripSignature(amsValue))}`;
    const ams = verifyData(amsSignBase, amsTags.b ?? "", publicKey, amsAlgorithm);

    // ARC-Seal: AAR + full AMS + the AS header with an emptied b=.
    const sealSignBase = [
        relaxedHeader("ARC-Authentication-Results", aarValue),
        relaxedHeader("ARC-Message-Signature", amsValue),
        relaxedHeader("ARC-Seal", stripSignature(sealValue)),
    ].join("\r\n");
    const seal = verifyData(sealSignBase, sealTags.b ?? "", publicKey, sealAlgorithm);

    const valid = ams && seal && bodyHash;

    return {
        components: { ams, bodyHash, seal },
        cv: sealTags.cv,
        reason: valid ? undefined : "signature-mismatch",
        valid,
    };
};

export type { ArcAlgorithm, ArcHeaderSet, ArcSealOptions, ArcVerifyOptions, ArcVerifyResult };
export { arcMessageSignatureBase, arcSealBase, signArc, verifyArc };
