import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
    clearOsvBloomCache,
    DEFAULT_OSV_BLOOM_SOURCE,
    getOsvBloomStatus,
    loadOsvBloomHandle,
    OsvBloomCacheMissError,
    OsvBloomIntegrityError,
    OsvBloomManifestError,
    OsvBloomNetworkError,
    OsvBloomSourceNotAllowedError,
    syncOsvBloom,
    validateOsvBloomSource,
} from "../../src/security/osv-bloom";

const sha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

interface MockResponse {
    body?: Buffer | string;
    etag?: string;
    status?: number;
}

const stubFetchSequence = (responses: MockResponse[]): ReturnType<typeof vi.fn> => {
    let index = 0;
    const handler = vi.fn(async (input: URL | string) => {
        const response = responses[Math.min(index, responses.length - 1)] ?? {};

        index += 1;

        const status = response.status ?? 200;
        const ok = status >= 200 && status < 300;
        const bodyText = typeof response.body === "string" ? response.body : "";
        const bodyBytes = typeof response.body === "string" ? Buffer.from(bodyText, "utf8") : response.body ?? Buffer.alloc(0);

        return {
            arrayBuffer: async () => bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
            body: bodyBytes.length > 0 ? {} : null,
            headers: {
                get: (key: string) => (key.toLowerCase() === "etag" ? response.etag ?? null : null),
            },
            ok,
            status,
            text: async () => bodyText || bodyBytes.toString("utf8"),
            url: String(input),
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

interface BuildBloomFixtureOptions {
    bytes?: Buffer;
    overrides?: Partial<Record<string, unknown>>;
    setDigest?: string;
}

const buildBloomFixture = ({ bytes, overrides, setDigest }: BuildBloomFixtureOptions = {}): { filterBytes: Buffer; manifestRaw: string } => {
    const filterBytes = bytes ?? Buffer.from("test-bloom-payload-bytes");

    const manifest: Record<string, unknown> = {
        advisory_count: 5,
        bloom_byte_len: filterBytes.length,
        bloom_k_hashes: 8,
        bloom_m_bits: 4096,
        built_at_rfc3339: "2026-05-14T00:00:00Z",
        built_at_unix: 1_747_180_800,
        entry_count: 12,
        filter_sha256: sha256Hex(filterBytes),
        format_version: 1,
        set_digest_sha256: setDigest ?? "11".repeat(32),
        source_url: "https://github.com/endevco/osv-bloom",
        target_fpr: 0.001,
        ...overrides,
    };

    return { filterBytes, manifestRaw: JSON.stringify(manifest) };
};

describe(validateOsvBloomSource, () => {
    it("accepts the default upstream GH Pages host", () => {
        expect.assertions(1);

        const url = validateOsvBloomSource(DEFAULT_OSV_BLOOM_SOURCE);

        expect(url.host).toBe("endevco.github.io");
    });

    it("rejects http:// sources", () => {
        expect.assertions(1);

        // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test that http:// is rejected
        expect(() => validateOsvBloomSource("http://endevco.github.io/osv-bloom")).toThrow(OsvBloomSourceNotAllowedError);
    });

    it("rejects hosts not in the built-in allowlist", () => {
        expect.assertions(1);

        expect(() => validateOsvBloomSource("https://attacker.example.com")).toThrow(OsvBloomSourceNotAllowedError);
    });

    it("accepts a user-declared allowlisted host", () => {
        expect.assertions(1);

        const url = validateOsvBloomSource("https://mirror.example.com/osv-bloom", ["mirror.example.com"]);

        expect(url.host).toBe("mirror.example.com");
    });

    it("rejects malformed URLs", () => {
        expect.assertions(1);

        expect(() => validateOsvBloomSource("not-a-url")).toThrow(OsvBloomSourceNotAllowedError);
    });

    it("rejects URLs with an empty host", () => {
        expect.assertions(1);

        expect(() => validateOsvBloomSource("https:///path")).toThrow(OsvBloomSourceNotAllowedError);
    });
});

describe("osvBloom error classes", () => {
    it("osvBloomSourceNotAllowedError carries the typed cause", () => {
        expect.assertions(2);

        const error = new OsvBloomSourceNotAllowedError("attacker.example.com");

        expect(error.message).toContain("attacker.example.com");
        expect(error.cause).toBe("OSV_BLOOM_SOURCE_NOT_ALLOWED");
    });

    it("osvBloomIntegrityError carries the typed cause", () => {
        expect.assertions(3);

        const error = new OsvBloomIntegrityError("aa".repeat(32), "bb".repeat(32));

        expect(error.message).toContain("aa".repeat(32));
        expect(error.message).toContain("bb".repeat(32));
        expect(error.cause).toBe("OSV_BLOOM_INTEGRITY");
    });

    it("osvBloomCacheMissError points to the bloom sync command", () => {
        expect.assertions(2);

        const error = new OsvBloomCacheMissError("/tmp/no/such");

        expect(error.message).toContain("vis advisories bloom sync");
        expect(error.cause).toBe("OSV_BLOOM_CACHE_MISS");
    });

    it("osvBloomNetworkError carries the typed cause", () => {
        expect.assertions(2);

        const error = new OsvBloomNetworkError("https://example.com/x", 503);

        expect(error.message).toContain("503");
        expect(error.cause).toBe("OSV_BLOOM_NETWORK");
    });

    it("osvBloomManifestError carries the typed cause", () => {
        expect.assertions(2);

        const error = new OsvBloomManifestError("bad json");

        expect(error.message).toContain("bad json");
        expect(error.cause).toBe("OSV_BLOOM_MANIFEST");
    });
});

describe(syncOsvBloom, () => {
    let cacheDir: string;

    beforeEach(() => {
        cacheDir = mkdtempSync(join(tmpdir(), "vis-osv-bloom-"));
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(cacheDir)) {
            rmSync(cacheDir, { force: true, recursive: true });
        }
    });

    it("downloads manifest + filter on first sync", async () => {
        expect.assertions(4);

        const { filterBytes, manifestRaw } = buildBloomFixture();

        const handler = stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "W/\"first-etag\"" },
        ]);

        const result = await syncOsvBloom({
            cacheDir,
            source: DEFAULT_OSV_BLOOM_SOURCE,
            workspaceRoot: cacheDir,
        });

        expect(result.upToDate).toBe(false);
        expect(result.bytesOnDisk).toBe(filterBytes.length);
        expect(handler).toHaveBeenCalledTimes(2);

        const written = await readFile(join(cacheDir, "filter.bin"));

        expect(written.equals(filterBytes)).toBe(true);
    });

    it("short-circuits when the set digest matches the cached state", async () => {
        expect.assertions(2);

        const setDigest = "ab".repeat(32);
        const { filterBytes, manifestRaw } = buildBloomFixture({ setDigest });

        stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "etag-1" },
        ]);

        await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        const secondHandler = stubFetchSequence([{ body: manifestRaw }]);

        const result = await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        expect(result.upToDate).toBe(true);
        expect(secondHandler).toHaveBeenCalledTimes(1);
    });

    it("short-circuits on the 304 ETag branch when the set digest changed but the filter didn't", async () => {
        expect.assertions(3);

        const sharedEtag = "W/\"shared-filter-etag\"";
        const initialDigest = "11".repeat(32);
        const { filterBytes, manifestRaw: initialManifest } = buildBloomFixture({ setDigest: initialDigest });

        stubFetchSequence([
            { body: initialManifest },
            { body: filterBytes, etag: sharedEtag },
        ]);

        await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        const rotatedDigest = "22".repeat(32);
        const { manifestRaw: rotatedManifest } = buildBloomFixture({ bytes: filterBytes, setDigest: rotatedDigest });

        const secondHandler = stubFetchSequence([
            { body: rotatedManifest },
            { etag: sharedEtag, status: 304 },
        ]);

        const result = await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        expect(result.upToDate).toBe(true);
        expect(result.bytesOnDisk).toBe(filterBytes.length);
        expect(secondHandler).toHaveBeenCalledTimes(2);
    });

    it("honours --force and re-downloads even when the set digest matches", async () => {
        expect.assertions(2);

        const setDigest = "cd".repeat(32);
        const { filterBytes, manifestRaw } = buildBloomFixture({ setDigest });

        stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "etag-a" },
        ]);

        await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        const forcedHandler = stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "etag-b" },
        ]);

        const result = await syncOsvBloom({ cacheDir, force: true, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        expect(result.upToDate).toBe(false);
        expect(forcedHandler).toHaveBeenCalledTimes(2);
    });

    it("rejects a filter.bin whose sha256 doesn't match the manifest", async () => {
        expect.assertions(1);

        const { manifestRaw } = buildBloomFixture();
        const tamperedBytes = Buffer.from("tampered-payload-bytes-that-do-not-match");

        stubFetchSequence([
            { body: manifestRaw },
            { body: tamperedBytes, etag: "evil-etag" },
        ]);

        await expect(syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir })).rejects.toBeInstanceOf(OsvBloomIntegrityError);
    });

    it("rejects a filter.bin whose length doesn't match bloom_byte_len", async () => {
        expect.assertions(1);

        const filterBytes = Buffer.from("the-real-bytes");
        const wrongLenManifest = buildBloomFixture({ bytes: filterBytes, overrides: { bloom_byte_len: 9999, filter_sha256: sha256Hex(filterBytes) } });

        stubFetchSequence([
            { body: wrongLenManifest.manifestRaw },
            { body: filterBytes, etag: "tagged" },
        ]);

        await expect(syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir })).rejects.toBeInstanceOf(OsvBloomManifestError);
    });

    it("rejects an unsupported format_version", async () => {
        expect.assertions(1);

        const { manifestRaw } = buildBloomFixture({ overrides: { format_version: 99 } });

        stubFetchSequence([{ body: manifestRaw }]);

        await expect(syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir })).rejects.toBeInstanceOf(OsvBloomManifestError);
    });

    it("rejects a hostile source URL before issuing any request", async () => {
        expect.assertions(2);

        const handler = stubFetchSequence([]);

        await expect(
            syncOsvBloom({ cacheDir, source: "https://attacker.example.com", workspaceRoot: cacheDir }),
        ).rejects.toBeInstanceOf(OsvBloomSourceNotAllowedError);

        expect(handler).not.toHaveBeenCalled();
    });

    it("surfaces upstream errors as OsvBloomNetworkError", async () => {
        expect.assertions(1);

        stubFetchSequence([{ body: "internal error", status: 503 }]);

        await expect(syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir })).rejects.toBeInstanceOf(OsvBloomNetworkError);
    });
});

describe(getOsvBloomStatus, () => {
    let cacheDir: string;

    beforeEach(() => {
        cacheDir = mkdtempSync(join(tmpdir(), "vis-osv-bloom-status-"));
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(cacheDir)) {
            rmSync(cacheDir, { force: true, recursive: true });
        }
    });

    it("reports `present: false` when nothing has been cached", async () => {
        expect.assertions(2);

        const status = await getOsvBloomStatus(cacheDir, cacheDir);

        expect(status.present).toBe(false);
        expect(status.manifest).toBeUndefined();
    });

    it("returns manifest + fetchedAt after a successful sync", async () => {
        expect.assertions(2);

        const { filterBytes, manifestRaw } = buildBloomFixture({ setDigest: "ef".repeat(32) });

        stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "after-sync" },
        ]);

        await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        const status = await getOsvBloomStatus(cacheDir, cacheDir);

        expect(status.present).toBe(true);
        expect(status.manifest?.setDigestSha256).toBe("ef".repeat(32));

        expectTypeOf(status.fetchedAtIso).toBeString();
    });
});

describe(loadOsvBloomHandle, () => {
    let cacheDir: string;

    beforeEach(() => {
        cacheDir = mkdtempSync(join(tmpdir(), "vis-osv-bloom-load-"));
    });

    afterEach(() => {
        if (existsSync(cacheDir)) {
            rmSync(cacheDir, { force: true, recursive: true });
        }
    });

    it("throws OsvBloomCacheMissError when softFail is false and the cache is missing", async () => {
        expect.assertions(1);

        await expect(loadOsvBloomHandle(cacheDir, { cacheDir })).rejects.toBeInstanceOf(OsvBloomCacheMissError);
    });

    it("returns null when softFail is true and the cache is missing", async () => {
        expect.assertions(1);

        const handle = await loadOsvBloomHandle(cacheDir, { cacheDir, softFail: true });

        expect(handle).toBeNull();
    });
});

describe(clearOsvBloomCache, () => {
    it("removes the cache directory", async () => {
        expect.assertions(2);

        const cacheDir = mkdtempSync(join(tmpdir(), "vis-osv-bloom-clear-"));
        const { filterBytes, manifestRaw } = buildBloomFixture({ setDigest: "01".repeat(32) });

        stubFetchSequence([
            { body: manifestRaw },
            { body: filterBytes, etag: "x" },
        ]);

        await syncOsvBloom({ cacheDir, source: DEFAULT_OSV_BLOOM_SOURCE, workspaceRoot: cacheDir });

        expect(existsSync(join(cacheDir, "filter.bin"))).toBe(true);

        await clearOsvBloomCache(cacheDir, cacheDir);

        expect(existsSync(cacheDir)).toBe(false);

        vi.unstubAllGlobals();
    });
});
