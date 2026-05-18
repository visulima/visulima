import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

import type { RemoteCacheAttestation } from "@visulima/task-runner";

import { loadOptionalSigstore } from "./loader";

/**
 * Wires Sigstore keyless sign/verify into the task-runner HTTP backend's
 * dependency-free attestation hooks. Layered above the HMAC `signing`
 * block: HMAC is integrity (tamper-evidence under a shared secret),
 * this is authenticity (a Fulcio identity, logged in Rekor).
 *
 * The payload we sign is the artifact's sha256 — recomputed from disk
 * on both ends rather than trusting the `hash` the caller passes, so a
 * server that swaps bytes but echoes the requested digest still fails
 * verification.
 *
 * Authenticity requires pinning *who* signed: `verifyArtifact` enforces
 * `expectedIdentity` (OIDC issuer + certificate SAN). A bundle with a
 * valid Fulcio chain but an unexpected signer is rejected — without the
 * pin, anyone who can write to the cache could mint their own keyless
 * bundle over the same digest and it would pass (integrity, not
 * authenticity). Wiring requests verification but supplies no
 * `expectedIdentity` is therefore a misconfiguration and rejected up
 * front (see `run/handler`).
 *
 * SAN matching hazard: sigstore-js matches `certificateIdentityURI`
 * with `String.prototype.match`, i.e. as an *unanchored regex*. A bare
 * URI is over-permissive (`.` is any char) and substring-matched (a
 * longer attacker SAN that merely *contains* it passes). So the public
 * API takes a *literal* identity by default — `{ github }` or
 * `{ oidcIssuer, san }` — and `normalizeExpectedIdentity` regex-escapes
 * and `^…$`-anchors it here. The `{ oidcIssuer, sanRegex }` form is the
 * escape hatch for callers who genuinely need a pattern; they own
 * anchoring.
 *
 * Signing needs an ambient OIDC token (CI). Outside CI `signArtifact`
 * returns `null` (upload proceeds unsigned) — local dev shouldn't block
 * on a Fulcio round-trip it can't complete. Consequence: a workspace
 * that mixes local (unsigned) and CI (signed) producers against one
 * cache will see local entries rejected by any consumer with
 * `requireOnDownload`, forcing re-execution until CI repopulates them.
 * That is intended; set `requireOnDownload` only where every producer
 * runs in CI.
 */

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";

const escapeRegex = (value: string): string => value.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

export type ExpectedSignerIdentity = NonNullable<RemoteCacheAttestation["expectedIdentity"]>;

/**
 * Collapse the three public identity forms into the single
 * `{ issuer, sanPattern }` shape sigstore-js consumes. `sanPattern` is
 * always a regex string fed to `certificateIdentityURI`:
 *
 * - `github` → issuer is the Actions Fulcio issuer; SAN is the literal
 *   `https://github.com/{repo}/{workflow}@{ref}`, escaped and anchored.
 * - `san` → literal identity, escaped and anchored (`^…$`).
 * - `sanRegex` → passthrough; the caller owns escaping and anchoring.
 */
export const normalizeExpectedIdentity = (identity: ExpectedSignerIdentity): { issuer: string; sanPattern: string } => {
    if ("github" in identity) {
        const { ref, repo, workflow } = identity.github;

        return {
            issuer: GITHUB_ISSUER,
            sanPattern: `^${escapeRegex(`https://github.com/${repo}/${workflow}@${ref}`)}$`,
        };
    }

    if ("sanRegex" in identity) {
        return { issuer: identity.oidcIssuer, sanPattern: identity.sanRegex };
    }

    return { issuer: identity.oidcIssuer, sanPattern: `^${escapeRegex(identity.san)}$` };
};

const hasAmbientOidc = (): boolean =>
    process.env.CI === "true" || typeof process.env.ACTIONS_ID_TOKEN_REQUEST_URL === "string" || typeof process.env.SIGSTORE_ID_TOKEN === "string";

const digestFile = (archivePath: string): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const hash = createHash("sha256");
        const stream = createReadStream(archivePath);

        stream.on("error", reject);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => {
            resolve(Buffer.from(hash.digest("hex")));
        });
    });

export interface CacheAttestationOptions {
    /**
     * Pinned keyless signer. Required: verifying a bundle without
     * pinning the identity proves integrity, not authenticity.
     */
    expectedIdentity: ExpectedSignerIdentity;

    /** Optional sink for rejection diagnostics (silent otherwise). */
    onReject?: (hash: string, reason: "invalid" | "missing") => void;

    /**
     * Called when sigstore verification throws, with the underlying
     * error message (e.g. `certificate identity error - expected …,
     * got …`). Lets the caller surface *why* a bundle was rejected —
     * an unexpected-signer mismatch reads very differently from a
     * broken chain. Distinct from `onReject`, which fires once per
     * rejected download regardless of cause.
     */
    onVerifyFailure?: (message: string) => void;

    requireOnDownload?: boolean;
    workspaceRoot: string;
}

// Cap the per-process verify memo so a long-lived process (watch mode)
// hitting many distinct artifacts can't grow it without bound.
const MAX_VERIFY_MEMO = 1024;

export const buildCacheAttestationHooks = (options: CacheAttestationOptions): RemoteCacheAttestation => {
    const { issuer, sanPattern } = normalizeExpectedIdentity(options.expectedIdentity);

    // Verification hits Rekor over the network. The same artifact can be
    // restored by many tasks in one run; memoize per-process so a remote
    // cache with N hits of the same artifact pays one round-trip, not N.
    //
    // SECURITY: the memo key MUST bind both the artifact's content digest
    // *and* the full attestation, not a bundle prefix. Sigstore bundles
    // share a near-constant JSON prefix, so keying on a prefix would let
    // a verified result for artifact A satisfy a different artifact B —
    // silently defeating the per-artifact payload binding. Identical
    // (digest, bundle) genuinely yields an identical verification result,
    // so this is the only safe thing to dedupe on.
    const verifyMemo = new Map<string, Promise<boolean>>();

    const verifyOnce = (archivePath: string, attestation: string): Promise<boolean> => {
        let bundle: unknown;

        try {
            bundle = JSON.parse(attestation) as unknown;
        } catch {
            return Promise.resolve(false);
        }

        const run = (async (): Promise<boolean> => {
            let payload: Buffer;

            try {
                payload = await digestFile(archivePath);
            } catch {
                return false;
            }

            const memoKey = `${payload.toString("utf8")}:${createHash("sha256").update(attestation).digest("hex")}`;
            const cached = verifyMemo.get(memoKey);

            if (cached) {
                return cached;
            }

            const verified = (async (): Promise<boolean> => {
                try {
                    const sigstore = await loadOptionalSigstore({ workspaceRoot: options.workspaceRoot });

                    await sigstore.verify(bundle, payload, {
                        certificateIdentityURI: sanPattern,
                        certificateIssuer: issuer,
                    });

                    return true;
                } catch (error) {
                    options.onVerifyFailure?.(error instanceof Error ? error.message : String(error));

                    return false;
                }
            })();

            if (verifyMemo.size >= MAX_VERIFY_MEMO) {
                verifyMemo.clear();
            }

            verifyMemo.set(memoKey, verified);

            return verified;
        })();

        return run;
    };

    return {
        expectedIdentity: options.expectedIdentity,
        onReject: options.onReject,
        requireOnDownload: options.requireOnDownload ?? false,

        signArtifact: async ({ archivePath }) => {
            if (!hasAmbientOidc()) {
                return null;
            }

            const sigstore = await loadOptionalSigstore({ workspaceRoot: options.workspaceRoot });
            const payload = await digestFile(archivePath);
            const bundle = await sigstore.sign(payload);

            return JSON.stringify(bundle);
        },

        verifyArtifact: ({ archivePath, attestation }) => verifyOnce(archivePath, attestation),
    };
};
