/**
 * Registry signature marshall.
 *
 * Verifies each resolved version's `dist.signatures` against npm's published
 * signing keys (`https://registry.npmjs.org/-/npm/v1/keys`). The signed
 * message is `${name}@${version}:${integrity}` — npm's stable format.
 *
 * Findings:
 *   - `missing-signature` (warning) — package wasn't signed at all.
 *   - `unknown-keyid` (error) — signed with a keyid the registry doesn't
 *     advertise; could be a MITM or a long-rotated key.
 *   - `expired-key` (configurable severity) — known keyid but it's past
 *     its `expires` date.
 *   - `invalid-signature` (error) — math doesn't check out; tampering.
 *   - `fetch-failed` (warning) — couldn't reach the keys endpoint.
 */

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";
import type { RegistryKey } from "./registry-keys";
import { fetchRegistryKeys } from "./registry-keys";
import { verifyEcdsaSignature } from "./verify-ecdsa";

export type SignatureCode = "expired-key" | "fetch-failed" | "invalid-signature" | "missing-signature" | "unknown-keyid";

export interface SignatureFinding {
    code: SignatureCode;
    keyid?: string;
    message: string;
    packageName: string;
    severity: "error" | "warning";
    version: string;
}

export interface RunSignatureMarshallOptions {
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    keysTtlMs?: number;
    /** Override the keys endpoint (mirrors); falls through to `VIS_NPM_KEYS_URL`. */
    keysUrl?: string;
    signal?: AbortSignal;
    treatExpiredAs?: "error" | "warning";
    workspaceRoot?: string;
}

const isKeyExpired = (key: RegistryKey, now: number): boolean => {
    if (key.expires === undefined || key.expires === "") {
        return false;
    }

    const expiresAt = Date.parse(key.expires);

    if (Number.isNaN(expiresAt)) {
        return false;
    }

    return expiresAt <= now;
};

const buildSignedMessage = (name: string, version: string, integrity: string): string => `${name}@${version}:${integrity}`;

const resolveLatestVersion = (versions: string[], latestTag: string | undefined): string | undefined => {
    if (latestTag !== undefined && versions.includes(latestTag)) {
        return latestTag;
    }

    return versions.at(-1);
};

export const runSignatureMarshall = async (
    packages: { name: string; version: string }[],
    options: RunSignatureMarshallOptions = {},
): Promise<SignatureFinding[]> => {
    if (isMarshallDisabled("signatures")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const treatExpiredAs: "error" | "warning" = options.treatExpiredAs ?? "warning";
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const keysResult = await fetchRegistryKeys({ keysUrl: options.keysUrl, signal: options.signal, ttlMs: options.keysTtlMs });

    if (keysResult === undefined) {
        return packages
            .filter(({ name }) => !allowlist.has(name))
            .map(({ name, version }): SignatureFinding => {
                return {
                    code: "fetch-failed",
                    message: "Could not fetch registry signing keys.",
                    packageName: name,
                    severity: "warning",
                    version,
                };
            });
    }

    const keysByid = new Map<string, RegistryKey>();

    for (const key of keysResult.keys) {
        keysByid.set(key.keyid, key);
    }

    const now = Date.now();

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<SignatureFinding[]> => {
        if (allowlist.has(name)) {
            return [];
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return [];
        }

        const entry = packument.versions[version]
            ?? packument.versions[resolveLatestVersion(Object.keys(packument.versions), packument["dist-tags"]?.latest) ?? ""];

        if (entry === undefined) {
            return [];
        }

        const signatures = entry.dist?.signatures;
        const integrity = entry.dist?.integrity;

        if (signatures === undefined || signatures.length === 0) {
            return [{
                code: "missing-signature",
                message: `Package ${name}@${version} has no dist.signatures from the registry.`,
                packageName: name,
                severity: "warning",
                version,
            }];
        }

        if (typeof integrity !== "string" || integrity === "") {
            return [{
                code: "missing-signature",
                message: `Package ${name}@${version} has signatures but no dist.integrity to verify against.`,
                packageName: name,
                severity: "warning",
                version,
            }];
        }

        const signedMessage = buildSignedMessage(name, version, integrity);
        const localFindings: SignatureFinding[] = [];

        for (const signature of signatures) {
            const key = keysByid.get(signature.keyid);

            if (key === undefined) {
                localFindings.push({
                    code: "unknown-keyid",
                    keyid: signature.keyid,
                    message: `Package ${name}@${version} was signed with an unrecognized keyid (${signature.keyid}).`,
                    packageName: name,
                    severity: "error",
                    version,
                });

                continue;
            }

            if (isKeyExpired(key, now)) {
                localFindings.push({
                    code: "expired-key",
                    keyid: signature.keyid,
                    message: `Package ${name}@${version} was signed with an expired key (${signature.keyid}, expired ${key.expires ?? "unknown"}).`,
                    packageName: name,
                    severity: treatExpiredAs,
                    version,
                });

                continue;
            }

            const ok = verifyEcdsaSignature({ keyBase64: key.key, message: signedMessage, signatureBase64: signature.sig });

            if (!ok) {
                localFindings.push({
                    code: "invalid-signature",
                    keyid: signature.keyid,
                    message: `Package ${name}@${version} signature did not verify against ${signature.keyid}.`,
                    packageName: name,
                    severity: "error",
                    version,
                });
            }
        }

        return localFindings;
    });

    return perPackage.flat();
};
