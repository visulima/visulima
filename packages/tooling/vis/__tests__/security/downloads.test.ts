import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDownloadsCache, runDownloadsMarshall } from "../../src/security/marshalls/downloads";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (response: { body?: unknown; status?: number }): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => response.body ?? {},
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

describe(runDownloadsMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-downloads-"));
        clearDownloadsCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns an error finding when downloads fall below the error threshold", async () => {
        expect.assertions(2);

        stubFetch({ body: { downloads: 5 } });

        const findings = await runDownloadsMarshall(["demo"]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            downloadsLastMonth: 5,
            kind: "below-error",
            packageName: "demo",
            severity: "error",
        });
    });

    it("returns a warning when downloads fall in the warn band", async () => {
        expect.assertions(1);

        stubFetch({ body: { downloads: 5000 } });

        const findings = await runDownloadsMarshall(["demo"]);

        expect(findings[0]).toStrictEqual({
            downloadsLastMonth: 5000,
            kind: "below-warning",
            packageName: "demo",
            severity: "warning",
        });
    });

    it("returns no findings for popular packages above warnThreshold", async () => {
        expect.assertions(1);

        stubFetch({ body: { downloads: 1_000_000 } });

        const findings = await runDownloadsMarshall(["demo"]);

        expect(findings).toStrictEqual([]);
    });

    it("surfaces a no-data warning when the stats API returns 404", async () => {
        expect.assertions(2);

        stubFetch({ status: 404 });

        const findings = await runDownloadsMarshall(["demo"]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            downloadsLastMonth: undefined,
            kind: "no-data",
            packageName: "demo",
            severity: "warning",
        });
    });

    it("surfaces a no-data warning on transient errors (429/5xx)", async () => {
        expect.assertions(1);

        stubFetch({ status: 429 });

        const findings = await runDownloadsMarshall(["demo"]);

        expect(findings[0]?.kind).toBe("no-data");
    });

    it("caches successful responses so the second call skips fetch", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: { downloads: 5000 } });

        await runDownloadsMarshall(["demo"]);
        await runDownloadsMarshall(["demo"]);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("re-fetches when the cache entry has expired", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: { downloads: 5000 } });

        await runDownloadsMarshall(["demo"], { cacheTtlMs: 1 });
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        await runDownloadsMarshall(["demo"], { cacheTtlMs: 1 });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("uRL-encodes scoped names", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: { downloads: 5000 } });

        await runDownloadsMarshall(["@scope/demo"]);

        const [url] = fetchSpy.mock.calls[0] as [string];

        expect(url).toBe("https://api.npmjs.org/downloads/point/last-month/%40scope%2Fdemo");
    });

    it("respects the allowlist", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetch({ body: { downloads: 5 } });

        const findings = await runDownloadsMarshall(["demo"], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns an empty array when MARSHALL_DISABLE_DOWNLOADS is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_DOWNLOADS;
        const fetchSpy = stubFetch({ body: { downloads: 5 } });

        try {
            process.env.MARSHALL_DISABLE_DOWNLOADS = "1";

            const findings = await runDownloadsMarshall(["demo"]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_DOWNLOADS;
            } else {
                process.env.MARSHALL_DISABLE_DOWNLOADS = previous;
            }
        }
    });
});

describe(clearDownloadsCache, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-downloads-clear-"));
        clearDownloadsCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns 0 when the directory does not exist", () => {
        expect.assertions(1);

        expect(clearDownloadsCache()).toBe(0);
    });

    it("removes every cached entry and reports the count", async () => {
        expect.assertions(2);

        stubFetch({ body: { downloads: 5000 } });

        await runDownloadsMarshall(["demo"]);
        await runDownloadsMarshall(["other"]);

        expect(clearDownloadsCache()).toBe(2);
        expect(clearDownloadsCache()).toBe(0);
    });
});
