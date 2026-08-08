/* eslint-disable no-secrets/no-secrets -- "SubjectPublicKeyInfo" is a standard X.509 term, not a credential */

/**
 * Minimal, dependency-free X.509 helpers for extracting an RSA public key from a PEM
 * certificate. Web Crypto's `importKey` accepts a `SubjectPublicKeyInfo` (`"spki"`) but not a
 * full X.509 certificate, so this walks the certificate's DER (TLV) structure to locate the
 * `SubjectPublicKeyInfo` and returns it for import. Edge-safe — no `node:*`, only `Uint8Array`
 * and the shared Web Crypto base64 helper.
 */

import type { Bytes } from "../providers/utils/webcrypto";
import { fromBase64Url } from "../providers/utils/webcrypto";

const PEM_HEADER = /-----BEGIN CERTIFICATE-----/u;
const PEM_FOOTER = /-----END CERTIFICATE-----/u;
const WHITESPACE = /\s+/gu;

/** DER tag for a SEQUENCE. */
const SEQUENCE = 0x30;

/** DER tag for the EXPLICIT `[0]` context class wrapping the optional `version` field. */
const CONTEXT_0 = 0xa0;

interface Tlv {
    /** Offset one past the end of this element (value end). */
    end: number;
    /** Length of the value in bytes. */
    length: number;
    /** DER tag byte. */
    tag: number;
    /** Offset of the first value byte. */
    valueOffset: number;
}

/**
 * Reads a single DER type-length-value triple starting at `offset`, supporting short- and
 * long-form lengths. Throws {@link RangeError} on a truncated element.
 * @param bytes The DER bytes.
 * @param offset The offset of the tag byte.
 * @returns The parsed TLV envelope.
 */
const readTlv = (bytes: Uint8Array, offset: number): Tlv => {
    if (offset + 2 > bytes.length) {
        throw new RangeError("truncated DER");
    }

    const tag = bytes[offset] ?? 0;
    const lengthByte = bytes[offset + 1] ?? 0;

    if (lengthByte < 0x80) {
        const valueOffset = offset + 2;

        return { end: valueOffset + lengthByte, length: lengthByte, tag, valueOffset };
    }

    // eslint-disable-next-line no-bitwise -- DER long-form length is defined bitwise
    const byteCount = lengthByte & 0x7f;
    let length = 0;

    for (let index = 0; index < byteCount; index += 1) {
        // eslint-disable-next-line no-bitwise -- assembling a big-endian length
        length = (length << 8) | (bytes[offset + 2 + index] ?? 0);
    }

    const valueOffset = offset + 2 + byteCount;

    if (valueOffset + length > bytes.length) {
        throw new RangeError("truncated DER");
    }

    return { end: valueOffset + length, length, tag, valueOffset };
};

/**
 * Decodes a PEM certificate into its DER bytes.
 * @param pem The PEM-encoded certificate.
 * @returns The DER bytes, or `undefined` when the input is not a base64 certificate body.
 */
const pemToDer = (pem: string): Bytes | undefined => {
    const base64 = pem.replace(PEM_HEADER, "").replace(PEM_FOOTER, "").replaceAll(WHITESPACE, "");

    if (base64.length === 0) {
        return undefined;
    }

    try {
        return fromBase64Url(base64);
    } catch {
        return undefined;
    }
};

/**
 * Extracts the `SubjectPublicKeyInfo` (SPKI) from a PEM X.509 certificate, ready to hand to
 * Web Crypto's `importKey("spki", …)`. Walks `Certificate → tbsCertificate` and skips the
 * fixed leading fields (optional `version`, `serialNumber`, `signature`, `issuer`, `validity`,
 * `subject`) to reach the public key. Returns `undefined` for malformed input rather than
 * throwing.
 * @param pem The PEM-encoded certificate.
 * @returns The SPKI DER bytes, or `undefined`.
 */
// eslint-disable-next-line import/prefer-default-export -- named export mirrors the rest of the webhooks module
export const pemCertificateToSpki = (pem: string): Bytes | undefined => {
    const der = pemToDer(pem);

    if (der === undefined) {
        return undefined;
    }

    try {
        const certificate = readTlv(der, 0);

        if (certificate.tag !== SEQUENCE) {
            return undefined;
        }

        const tbs = readTlv(der, certificate.valueOffset);

        if (tbs.tag !== SEQUENCE) {
            return undefined;
        }

        let offset = tbs.valueOffset;
        const first = readTlv(der, offset);

        // The `version` field is `[0] EXPLICIT` and optional; skip it when present.
        if (first.tag === CONTEXT_0) {
            offset = first.end;
        }

        // Skip serialNumber, signature, issuer, validity, subject in order.
        for (let field = 0; field < 5; field += 1) {
            offset = readTlv(der, offset).end;
        }

        const spki = readTlv(der, offset);

        if (spki.tag !== SEQUENCE) {
            return undefined;
        }

        // Return a fresh ArrayBuffer-backed copy of the full SPKI element (tag + length + value).
        const copy = new Uint8Array(new ArrayBuffer(spki.end - offset));

        copy.set(der.subarray(offset, spki.end));

        return copy;
    } catch {
        return undefined;
    }
};
