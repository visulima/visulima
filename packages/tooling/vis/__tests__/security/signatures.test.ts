import { createSign, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache } from "../../src/security/marshalls/packument";
import { clearRegistryKeysCache } from "../../src/security/marshalls/registry-keys";
import { runSignatureMarshall } from "../../src/security/marshalls/signatures";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

interface GeneratedKeyPair {
    keyid: string;
    publicKeySpkiBase64: string;
    sign: (message: string) => string;
}

const generateKeyMaterial = (keyid: string): GeneratedKeyPair => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const spkiDer = publicKey.export({ format: "der", type: "spki" });

    return {
        keyid,
        publicKeySpkiBase64: spkiDer.toString("base64"),
        sign: (message: string) => {
            const signer = createSign("SHA256");

            signer.update(message);
            signer.end();

            return signer.sign(privateKey).toString("base64");
        },
    };
};

interface StubResponse {
    body?: unknown;
    status?: number;
}

const stubFetchSequence = (responses: StubResponse[]): ReturnType<typeof vi.fn> => {
    let index = 0;
    const handler = vi.fn(async () => {
        const response = responses[Math.min(index, responses.length - 1)] ?? {};

        index += 1;

        return Promise.resolve({
            json: async () => Promise.resolve(response.body ?? {}),
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        });
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packumentBody = (signatures: { keyid: string; sig: string }[] | undefined, integrity: string | undefined): Record<string, unknown> => ({
    "dist-tags": { latest: "1.0.0" },
    name: "demo",
    versions: {
        "1.0.0": {
            dist: {
                ...(integrity === undefined ? {} : { integrity }),
                ...(signatures === undefined ? {} : { signatures }),
                tarball: "https://registry.npmjs.org/demo/-/demo-1.0.0.tgz",
            },
            version: "1.0.0",
        },
    },
});

const keysBody = (keys: { expires?: string; key: string; keyid: string }[]): { keys: { expires?: string; key: string; keyid: string }[] } => ({
    keys,
});

describe(runSignatureMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-signatures-"));
        clearPackumentCache();
        clearRegistryKeysCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns no findings when the signature verifies", async () => {
        expect.assertions(1);

        const integrity = "sha512-fakeintegrity==";
        const key = generateKeyMaterial("SHA256:test-key");
        const message = `demo@1.0.0:${integrity}`;
        const signature = key.sign(message);

        stubFetchSequence([
            { body: keysBody([{ key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: signature }], integrity) },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("flags an invalid signature as an error", async () => {
        expect.assertions(2);

        const integrity = "sha512-fakeintegrity==";
        const key = generateKeyMaterial("SHA256:test-key");
        const realMessage = `demo@1.0.0:${integrity}`;
        const wrongMessage = `other@1.0.0:${integrity}`;
        const tamperedSignature = key.sign(wrongMessage);

        // Ensure these signatures are genuinely different from one that would verify against realMessage.
        void realMessage;

        stubFetchSequence([
            { body: keysBody([{ key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: tamperedSignature }], integrity) },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]?.code).toBe("invalid-signature");
    });

    it("flags an unknown keyid as an error", async () => {
        expect.assertions(2);

        const known = generateKeyMaterial("SHA256:known");
        const attackerSignature = generateKeyMaterial("SHA256:rogue").sign("anything");

        stubFetchSequence([
            { body: keysBody([{ key: known.publicKeySpkiBase64, keyid: known.keyid }]) },
            { body: packumentBody([{ keyid: "SHA256:rogue", sig: attackerSignature }], "sha512-fakeintegrity==") },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.code).toBe("unknown-keyid");
        expect(findings[0]?.severity).toBe("error");
    });

    it("warns when the package is missing signatures", async () => {
        expect.assertions(2);

        stubFetchSequence([
            { body: keysBody([]) },
            { body: packumentBody(undefined, "sha512-fakeintegrity==") },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.code).toBe("missing-signature");
        expect(findings[0]?.severity).toBe("warning");
    });

    it("warns when signatures exist but integrity is missing", async () => {
        expect.assertions(1);

        const key = generateKeyMaterial("SHA256:test-key");

        stubFetchSequence([
            { body: keysBody([{ key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: "anything" }], undefined) },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.code).toBe("missing-signature");
    });

    it("emits expired-key as warning by default", async () => {
        expect.assertions(2);

        const integrity = "sha512-fakeintegrity==";
        const key = generateKeyMaterial("SHA256:expired");
        const message = `demo@1.0.0:${integrity}`;
        const signature = key.sign(message);
        const expiredIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        stubFetchSequence([
            { body: keysBody([{ expires: expiredIso, key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: signature }], integrity) },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings[0]?.code).toBe("expired-key");
        expect(findings[0]?.severity).toBe("warning");
    });

    it("upgrades expired-key to error when treatExpiredAs is 'error'", async () => {
        expect.assertions(1);

        const integrity = "sha512-fakeintegrity==";
        const key = generateKeyMaterial("SHA256:expired");
        const message = `demo@1.0.0:${integrity}`;
        const signature = key.sign(message);
        const expiredIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        stubFetchSequence([
            { body: keysBody([{ expires: expiredIso, key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: signature }], integrity) },
        ]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }], { treatExpiredAs: "error" });

        expect(findings[0]?.severity).toBe("error");
    });

    it("surfaces fetch-failed when both network and cache are unavailable", async () => {
        expect.assertions(2);

        stubFetchSequence([{ status: 503 }]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]?.code).toBe("fetch-failed");
    });

    it("reuses the on-disk keys cache across calls", async () => {
        expect.assertions(1);

        const integrity = "sha512-fakeintegrity==";
        const key = generateKeyMaterial("SHA256:cached");
        const message = `demo@1.0.0:${integrity}`;
        const signature = key.sign(message);

        const fetchSpy = stubFetchSequence([
            { body: keysBody([{ key: key.publicKeySpkiBase64, keyid: key.keyid }]) },
            { body: packumentBody([{ keyid: key.keyid, sig: signature }], integrity) },
            { body: packumentBody([{ keyid: key.keyid, sig: signature }], integrity) },
        ]);

        await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);
        clearPackumentCache();
        await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

        // First run: keys + packument (2 calls). Second run: only the new packument fetch (1 call).
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("respects the allowlist", async () => {
        expect.assertions(1);

        stubFetchSequence([{ body: keysBody([]) }]);

        const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("returns an empty array when MARSHALL_DISABLE_SIGNATURES is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_SIGNATURES;
        const fetchSpy = stubFetchSequence([{ body: keysBody([]) }]);

        try {
            process.env.MARSHALL_DISABLE_SIGNATURES = "1";

            const findings = await runSignatureMarshall([{ name: "demo", version: "1.0.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_SIGNATURES;
            } else {
                process.env.MARSHALL_DISABLE_SIGNATURES = previous;
            }
        }
    });
});
