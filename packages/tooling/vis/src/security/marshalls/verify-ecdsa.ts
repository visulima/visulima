/**
 * Tiny ECDSA P-256 / SHA-256 verifier built on `node:crypto`.
 *
 * The npm registry signs `${name}@${version}:${integrity}` with an ECDSA
 * P-256 key and returns the public key in base64-encoded SPKI form via
 * `https://registry.npmjs.org/-/npm/v1/keys`. We wrap that into PEM and let
 * `crypto.createVerify("SHA256")` do the actual math — keeps us free of any
 * heavyweight signature dep (sigstore, jose, …).
 */

import { createPublicKey, createVerify } from "node:crypto";

/** Wrap a base64 SPKI key into PEM form so `createPublicKey` accepts it. */
const wrapSpkiPem = (base64Spki: string): string => {
    const lines: string[] = ["-----BEGIN PUBLIC KEY-----"];
    const stripped = base64Spki.replaceAll(/\s+/g, "");

    for (let index = 0; index < stripped.length; index += 64) {
        lines.push(stripped.slice(index, index + 64));
    }

    lines.push("-----END PUBLIC KEY-----");

    return lines.join("\n");
};

export interface VerifyArgs {
    /** Base64-encoded SPKI public key as returned by `/-/npm/v1/keys`. */
    keyBase64: string;
    /** The signed message — `${name}@${version}:${integrity}` for npm. */
    message: string;
    /** Base64-encoded ECDSA signature (DER form, as npm sends it). */
    signatureBase64: string;
}

/**
 * Returns `true` when the signature verifies, `false` for anything else
 * (malformed key, malformed signature, mismatched signature). Never throws
 * — the caller distinguishes "invalid signature" from "missing signature"
 * elsewhere.
 */
export const verifyEcdsaSignature = ({ keyBase64, message, signatureBase64 }: VerifyArgs): boolean => {
    try {
        const publicKey = createPublicKey({ format: "pem", key: wrapSpkiPem(keyBase64) });
        const verifier = createVerify("SHA256");

        verifier.update(message);
        verifier.end();

        return verifier.verify(publicKey, Buffer.from(signatureBase64, "base64"));
    } catch {
        return false;
    }
};
