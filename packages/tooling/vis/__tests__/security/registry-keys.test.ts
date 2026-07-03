import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearRegistryKeysCache, fetchRegistryKeys } from "../../src/security/marshalls/registry-keys";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

interface StubResponse {
    body?: unknown;
    status?: number;
}

const stubFetchSequence = (responses: StubResponse[]): ReturnType<typeof vi.fn> => {
    let index = 0;
    const handler = vi.fn(async () => {
        const response = responses[Math.min(index, responses.length - 1)] ?? {};

        index += 1;

        return {
            json: async () => response.body ?? {},
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

describe(fetchRegistryKeys, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-registry-keys-"));
        clearRegistryKeysCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("fetches keys on first call and caches the result", async () => {
        expect.assertions(4);

        const fetchSpy = stubFetchSequence([{ body: { keys: [{ key: "base64key", keyid: "SHA256:abc" }] } }]);

        const first = await fetchRegistryKeys();

        expect(first?.fromCache).toBe(false);
        expect(first?.keys).toHaveLength(1);

        const second = await fetchRegistryKeys();

        expect(second?.fromCache).toBe(true);
        // First call hit the network; second was served from cache.
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("falls back to expired cache when network returns 5xx", async () => {
        expect.assertions(2);

        stubFetchSequence([{ body: { keys: [{ key: "base64key", keyid: "SHA256:abc" }] } }]);
        await fetchRegistryKeys();

        stubFetchSequence([{ status: 503 }]);
        const stale = await fetchRegistryKeys({ forceRefresh: true });

        expect(stale?.stale).toBe(true);
        expect(stale?.keys).toHaveLength(1);
    });

    it("returns undefined when no cache and network both fail", async () => {
        expect.assertions(1);

        stubFetchSequence([{ status: 503 }]);

        const result = await fetchRegistryKeys();

        expect(result).toBeUndefined();
    });

    it("honors keysUrl override", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetchSequence([{ body: { keys: [] } }]);

        await fetchRegistryKeys({ keysUrl: "https://example.test/keys" });

        const [url] = fetchSpy.mock.calls[0] as [string];

        expect(url).toBe("https://example.test/keys");
    });
});
