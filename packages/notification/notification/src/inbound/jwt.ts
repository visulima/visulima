import { fromBase64Url, hmac, sha256, toBase64Url, toHex, utf8 } from "../providers/utils/webcrypto";
import { timingSafeEqual } from "../webhooks/crypto";

/**
 * Decodes a base64url JWT segment into a JSON object, or `undefined` when it is not valid
 * base64url JSON.
 * @param segment The base64url-encoded segment.
 * @returns The decoded object, or `undefined`.
 */
const decodeSegment = (segment: string): Record<string, unknown> | undefined => {
    try {
        const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(segment)));

        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }

        return undefined;
    } catch {
        return undefined;
    }
};

/**
 * Computes the lowercase hex SHA-256 digest of a UTF-8 string — the encoding used by the
 * `payload_hash` / `url_hash` claims in MessageBird and Vonage signed webhooks.
 * @param value The string to hash.
 * @returns The hex digest.
 */
export const sha256Hex = async (value: string): Promise<string> => toHex(await sha256(utf8(value)));

/**
 * Verifies a compact HS256 JWT against `secret` and returns its decoded payload claims, or
 * `undefined` when the token is malformed, uses a different algorithm, or the signature does
 * not match. Signature comparison is constant-time. Edge-safe — Web Crypto only.
 * @param token The compact JWT (`header.payload.signature`).
 * @param secret The shared signing secret.
 * @returns The verified payload claims, or `undefined`.
 */
export const verifyHs256Jwt = async (token: string, secret: string): Promise<Record<string, unknown> | undefined> => {
    const parts = token.split(".");

    if (parts.length !== 3) {
        return undefined;
    }

    const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];
    const header = decodeSegment(headerSegment);

    if (header?.alg !== "HS256") {
        return undefined;
    }

    const expected = toBase64Url(await hmac(secret, `${headerSegment}.${payloadSegment}`, "SHA-256"));

    if (!timingSafeEqual(expected, signatureSegment)) {
        return undefined;
    }

    return decodeSegment(payloadSegment);
};

/**
 * Checks that a JWT's `exp` (and optional `nbf`) claims place `now` within the token's validity
 * window, allowing a small clock-skew tolerance. Missing claims are treated as unbounded.
 * @param payload The decoded claims.
 * @param toleranceSeconds The allowed clock skew (default 5 seconds).
 * @returns `true` when the token is temporally valid.
 */
export const isJwtTimeValid = (payload: Record<string, unknown>, toleranceSeconds = 5): boolean => {
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp === "number" && now > payload.exp + toleranceSeconds) {
        return false;
    }

    if (typeof payload.nbf === "number" && now + toleranceSeconds < payload.nbf) {
        return false;
    }

    return true;
};
