import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sigstoreMock = { attest: vi.fn(), sign: vi.fn(), verify: vi.fn() };

vi.mock(import("../../src/security/sigstore/loader"), () => {
    return {
        loadOptionalSigstore: vi.fn(async () => sigstoreMock),
    };
});

// eslint-disable-next-line import/first
import { buildCacheAttestationHooks, normalizeExpectedIdentity } from "../../src/security/sigstore/cache-attestation";

const IDENTITY = {
    oidcIssuer: "https://token.actions.githubusercontent.com",
    san: "https://github.com/org/repo/.github/workflows/ci.yml@refs/heads/main",
};

const NORMALIZED = normalizeExpectedIdentity(IDENTITY);

const makeArchive = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "vis-attest-"));
    const path = join(dir, "artifact.tgz");

    writeFileSync(path, "deterministic-bytes");

    return path;
};

describe(buildCacheAttestationHooks, () => {
    const originalCi = process.env.CI;

    beforeEach(() => {
        sigstoreMock.sign.mockReset();
        sigstoreMock.verify.mockReset();
        delete process.env.CI;
        delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
        delete process.env.SIGSTORE_ID_TOKEN;
    });

    afterEach(() => {
        if (originalCi === undefined) {
            delete process.env.CI;
        } else {
            process.env.CI = originalCi;
        }
    });

    it("should propagate requireOnDownload and expectedIdentity", () => {
        expect.assertions(2);

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, requireOnDownload: true, workspaceRoot: "/ws" });

        expect(hooks.requireOnDownload).toBe(true);
        expect(hooks.expectedIdentity).toStrictEqual(IDENTITY);
    });

    it("should skip signing (return null) when there is no ambient OIDC", async () => {
        expect.assertions(2);

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const result = await hooks.signArtifact?.({ archivePath: makeArchive(), hash: "abc" });

        expect(result).toBeNull();
        expect(sigstoreMock.sign).not.toHaveBeenCalled();
    });

    it("should sign the file digest when ambient OIDC is present", async () => {
        expect.assertions(2);

        process.env.CI = "true";
        sigstoreMock.sign.mockResolvedValue({ bundle: "b" });

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const result = await hooks.signArtifact?.({ archivePath: makeArchive(), hash: "abc" });

        expect(result).toBe(JSON.stringify({ bundle: "b" }));
        expect(sigstoreMock.sign).toHaveBeenCalledTimes(1);
    });

    it("should return false on malformed attestation JSON without calling verify", async () => {
        expect.assertions(2);

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const ok = await hooks.verifyArtifact?.({ archivePath: makeArchive(), attestation: "{not-json", hash: "abc" });

        expect(ok).toBe(false);
        expect(sigstoreMock.verify).not.toHaveBeenCalled();
    });

    it("should pin the expected signer identity when verifying", async () => {
        expect.assertions(2);

        sigstoreMock.verify.mockResolvedValue(undefined);

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const ok = await hooks.verifyArtifact?.({ archivePath: makeArchive(), attestation: JSON.stringify({ b: 1 }), hash: "abc" });

        expect(ok).toBe(true);
        expect(sigstoreMock.verify).toHaveBeenCalledWith({ b: 1 }, expect.any(Buffer), {
            certificateIdentityURI: NORMALIZED.sanPattern,
            certificateIssuer: NORMALIZED.issuer,
        });
    });

    it("escapes and anchors a literal san so sigstore can't substring-match it", () => {
        expect.assertions(2);

        const { issuer, sanPattern } = normalizeExpectedIdentity(IDENTITY);

        expect(issuer).toBe(IDENTITY.oidcIssuer);
        expect(sanPattern).toBe(String.raw`^https://github\.com/org/repo/\.github/workflows/ci\.yml@refs/heads/main$`);
    });

    it("expands the github preset to the Actions issuer and an anchored SAN", () => {
        expect.assertions(2);

        const { issuer, sanPattern } = normalizeExpectedIdentity({
            github: { ref: "refs/heads/main", repo: "visulima/visulima", workflow: ".github/workflows/release.yml" },
        });

        expect(issuer).toBe("https://token.actions.githubusercontent.com");
        expect(sanPattern).toBe(String.raw`^https://github\.com/visulima/visulima/\.github/workflows/release\.yml@refs/heads/main$`);
    });

    it("passes a sanRegex through unescaped and unanchored", () => {
        expect.assertions(2);

        const { issuer, sanPattern } = normalizeExpectedIdentity({
            oidcIssuer: "https://example.com",
            sanRegex: String.raw`^https://github\.com/org/.+@refs/tags/v.+$`,
        });

        expect(issuer).toBe("https://example.com");
        expect(sanPattern).toBe(String.raw`^https://github\.com/org/.+@refs/tags/v.+$`);
    });

    it("reports the sigstore error message via onVerifyFailure", async () => {
        expect.assertions(2);

        sigstoreMock.verify.mockRejectedValue(new Error("certificate identity error - expected A, got B"));

        const onVerifyFailure = vi.fn<(message: string) => void>();
        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, onVerifyFailure, workspaceRoot: "/ws" });
        const ok = await hooks.verifyArtifact?.({ archivePath: makeArchive(), attestation: JSON.stringify({ b: 1 }), hash: "abc" });

        expect(ok).toBe(false);
        expect(onVerifyFailure).toHaveBeenCalledWith("certificate identity error - expected A, got B");
    });

    it("should return false when sigstore.verify throws", async () => {
        expect.assertions(1);

        sigstoreMock.verify.mockRejectedValue(new Error("bad signature"));

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const ok = await hooks.verifyArtifact?.({ archivePath: makeArchive(), attestation: JSON.stringify({ b: 1 }), hash: "abc" });

        expect(ok).toBe(false);
    });

    it("memoizes only when both the artifact digest and bundle match", async () => {
        expect.assertions(5);

        sigstoreMock.verify.mockResolvedValue(undefined);

        const hooks = buildCacheAttestationHooks({ expectedIdentity: IDENTITY, workspaceRoot: "/ws" });
        const attestation = JSON.stringify({ b: 1 });

        // Same archive content (identical sha256) + same bundle → one verify.
        const sameArchive = makeArchive();
        const first = await hooks.verifyArtifact?.({ archivePath: sameArchive, attestation, hash: "abc" });
        const second = await hooks.verifyArtifact?.({ archivePath: sameArchive, attestation, hash: "def" });

        expect(first).toBe(true);
        expect(second).toBe(true);
        expect(sigstoreMock.verify).toHaveBeenCalledTimes(1);

        // A different artifact with the SAME bundle must NOT reuse the
        // cached result — the digest is part of the key (payload binding).
        const otherDir = mkdtempSync(join(tmpdir(), "vis-attest-"));
        const otherArchive = join(otherDir, "artifact.tgz");

        writeFileSync(otherArchive, "different-bytes");

        const third = await hooks.verifyArtifact?.({ archivePath: otherArchive, attestation, hash: "abc" });

        expect(third).toBe(true);
        expect(sigstoreMock.verify).toHaveBeenCalledTimes(2);
    });
});
