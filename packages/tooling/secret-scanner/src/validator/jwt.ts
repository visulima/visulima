import { Buffer } from "node:buffer";

import type { ValidationStatus } from "../types";

/**
 * Offline JWT validator. Mirrors Kingfisher's `type: JWT` semantics — a
 * "verified" match is a structurally-valid JWT: three base64url-encoded
 * segments, header + payload both JSON-parse, header carries an `alg` field.
 * Signature verification requires the signing key (we don't have it for random
 * captured tokens), so we stop at formal validity. No network.
 */
export const validateJwt = (token: string): ValidationStatus => {
    const parts = token.split(".");

    if (parts.length !== 3 || parts.some((segment) => segment.length === 0)) {
        return "rejected";
    }

    const decode = (segment: string): unknown => {
        const padded = segment.replaceAll("-", "+").replaceAll("_", "/");
        const buffer = Buffer.from(padded, "base64").toString("utf8");

        return JSON.parse(buffer);
    };

    let header: unknown;

    try {
        header = decode(parts[0] as string);
        decode(parts[1] as string);
    } catch {
        return "rejected";
    }

    if (typeof header !== "object" || header === null) {
        return "rejected";
    }

    const { alg } = header as { alg?: unknown };

    return typeof alg === "string" ? "verified" : "rejected";
};
