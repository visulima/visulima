import type { Bytes } from "../providers/utils/webcrypto";
import { fromBase64Url, subtle, utf8 } from "../providers/utils/webcrypto";

const HEX_PATTERN = /^[0-9a-f]*$/iu;

/**
 * Decodes a lowercase/uppercase hex string into `ArrayBuffer`-backed bytes. Returns
 * `undefined` for odd-length or non-hex input rather than throwing, so a malformed
 * signature header fails verification cleanly.
 * @param value The hex string.
 * @returns The decoded bytes, or `undefined` when the input is not valid hex.
 */
export const hexToBytes = (value: string): Bytes | undefined => {
    if (value.length % 2 !== 0 || !HEX_PATTERN.test(value)) {
        return undefined;
    }

    const bytes = new Uint8Array(new ArrayBuffer(value.length / 2));

    for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }

    return bytes;
};

/**
 * Verifies an Ed25519 signature over `timestamp + body`, Discord's interaction signing
 * scheme. Edge-safe — uses Web Crypto's Ed25519 primitive only (available on Node 22+ and
 * Cloudflare Workers). Any malformed input or unsupported-algorithm error resolves to
 * `false` rather than throwing.
 * @param publicKeyHex The application's Ed25519 public key (hex), from the Discord dashboard.
 * @param signatureHex The `X-Signature-Ed25519` header value (hex).
 * @param timestamp The `X-Signature-Timestamp` header value.
 * @param body The raw request body.
 * @returns `true` when the signature is valid.
 */
export const verifyEd25519 = async (publicKeyHex: string, signatureHex: string, timestamp: string, body: string): Promise<boolean> => {
    const publicKey = hexToBytes(publicKeyHex);
    const signature = hexToBytes(signatureHex);

    if (publicKey === undefined || signature === undefined) {
        return false;
    }

    try {
        const key = await subtle().importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);

        return await subtle().verify({ name: "Ed25519" }, key, signature, utf8(`${timestamp}${body}`));
    } catch {
        return false;
    }
};

/**
 * Verifies an Ed25519 signature over an arbitrary message, with the public key and signature
 * supplied as base64 (Telnyx's webhook signing scheme, where the signed message is
 * `{timestamp}|{body}`). Any malformed input resolves to `false` rather than throwing.
 * @param publicKeyBase64 The Ed25519 public key (base64).
 * @param signatureBase64 The header signature to check (base64).
 * @param message The exact string that was signed (e.g. `{timestamp}|{body}` for Telnyx).
 * @returns `true` when the signature is valid.
 */
export const verifyEd25519Base64 = async (publicKeyBase64: string, signatureBase64: string, message: string): Promise<boolean> => {
    try {
        const key = await subtle().importKey("raw", fromBase64Url(publicKeyBase64), { name: "Ed25519" }, false, ["verify"]);

        return await subtle().verify({ name: "Ed25519" }, key, fromBase64Url(signatureBase64), utf8(message));
    } catch {
        return false;
    }
};
