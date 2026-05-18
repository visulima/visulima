import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache, getPackument, resolveVersionRange } from "../../src/security/marshalls/packument";

// Redirect getVisCacheDir() at the homedir level so the cache file lives
// under a per-test tmpdir. vis-paths.ts derives cache from `homedir()`, so
// stubbing the user's HOME is the simplest seam.
let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const samplePackument = {
    "dist-tags": { latest: "1.2.0", next: "2.0.0-rc.1" },
    name: "demo",
    readme: "# demo",
    time: {
        "1.0.0": "2024-01-01T00:00:00Z",
        "1.2.0": "2024-06-01T00:00:00Z",
        "2.0.0-rc.1": "2024-07-15T00:00:00Z",
        created: "2024-01-01T00:00:00Z",
        modified: "2024-07-15T00:00:00Z",
    },
    versions: {
        "1.0.0": {
            _npmUser: { email: "maintainer@example.com", name: "maintainer" },
            bin: { demo: "./bin/demo.js" },
            dist: { integrity: "sha512-abc", signatures: [{ keyid: "key1", sig: "sig1" }], tarball: "https://example.com/demo-1.0.0.tgz" },
            license: "MIT",
            maintainers: [{ email: "maintainer@example.com", name: "maintainer" }],
            repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            version: "1.0.0",
        },
        "1.2.0": {
            _npmUser: { email: "maintainer@example.com", name: "maintainer" },
            bin: { demo: "./bin/demo.js", "demo-extra": "./bin/extra.js" },
            dist: { attestations: { provenance: { foo: "bar" } }, integrity: "sha512-def", signatures: [{ keyid: "key1", sig: "sig2" }] },
            license: "MIT",
            maintainers: [{ email: "maintainer@example.com", name: "maintainer" }],
            // a stray field that should NOT survive stripping
            random_extra_field: "drop me",
            repository: { type: "git", url: "git+https://github.com/example/demo.git" },
            version: "1.2.0",
        },
        "2.0.0-rc.1": {
            _npmUser: { email: "maintainer@example.com", name: "maintainer" },
            dist: { integrity: "sha512-ghi" },
            license: "MIT",
            maintainers: [{ email: "maintainer@example.com", name: "maintainer" }],
            version: "2.0.0-rc.1",
        },
    },
} as const;

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

describe(getPackument, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-packument-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns undefined when the registry replies 404", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetch({ status: 404 });
        const result = await getPackument("does-not-exist");

        expect(result).toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("fetches a packument and strips it to the marshall-relevant fields", async () => {
        expect.assertions(4);

        stubFetch({ body: samplePackument });

        const result = await getPackument("demo");

        expect(result?.name).toBe("demo");
        // eslint-disable-next-line no-underscore-dangle -- `_npmUser` is the npm registry field name.
        expect(result?.versions["1.0.0"]?._npmUser?.email).toBe("maintainer@example.com");
        // Stray fields are dropped.
        expect((result?.versions["1.2.0"] as Record<string, unknown>).random_extra_field).toBeUndefined();
        // Dist substructure preserved selectively.
        expect(result?.versions["1.0.0"]?.dist?.signatures?.[0]?.keyid).toBe("key1");
    });

    it("serves the second call from the file cache without a second fetch", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: samplePackument });

        await getPackument("demo");
        await getPackument("demo");

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retains per-version install scripts (s1ngularity marshall reads them)", async () => {
        expect.assertions(1);

        stubFetch({
            body: {
                name: "demo",
                versions: {
                    "1.0.0": { scripts: { build: "tsc", postinstall: "node telemetry.js" }, version: "1.0.0" },
                },
            },
        });

        const result = await getPackument("demo");

        expect(result?.versions["1.0.0"]?.scripts).toStrictEqual({ build: "tsc", postinstall: "node telemetry.js" });
    });

    it("invalidates a cache entry written by an older schema version", async () => {
        expect.assertions(2);

        const fetchSpy = stubFetch({ body: samplePackument });

        await getPackument("demo");

        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // Simulate an entry written by a pre-`scripts` binary (cacheVersion 1).
        const cacheFiles = readdirSync(homeOverride, { recursive: true, withFileTypes: true })
            .filter((d) => d.isFile() && d.name === "demo.json")
            .map((d) => join(d.parentPath, d.name));
        const stale = JSON.parse(readFileSync(cacheFiles[0] as string, "utf8")) as { cacheVersion: number };

        stale.cacheVersion = 1;
        writeFileSync(cacheFiles[0] as string, JSON.stringify(stale), "utf8");

        await getPackument("demo");

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("re-fetches when the cache entry has expired", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: samplePackument });

        // TTL 1ms guarantees the second call sees an expired entry.
        await getPackument("demo", { cacheTtlMs: 1 });
        await new Promise((resolve) => {
            setTimeout(resolve, 5);
        });
        await getPackument("demo", { cacheTtlMs: 1 });

        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws on registry 5xx so callers can degrade explicitly", async () => {
        expect.assertions(1);

        stubFetch({ status: 503 });

        await expect(getPackument("demo")).rejects.toThrow(/503/);
    });

    it("forwards Authorization when an auth token is supplied", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: samplePackument });

        await getPackument("demo", { authToken: "deadbeef" });

        const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;

        expect(headers["Authorization"]).toBe("Bearer deadbeef");
    });

    it("uRL-encodes scoped package names", async () => {
        expect.assertions(1);

        const fetchSpy = stubFetch({ body: { ...samplePackument, name: "@scope/demo" } });

        await getPackument("@scope/demo");

        const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];

        expect(url).toBe("https://registry.npmjs.org/@scope%2fdemo");
    });
});

describe(resolveVersionRange, () => {
    const packument = {
        "dist-tags": { latest: "1.2.0", next: "2.0.0-rc.1" },
        name: "demo",
        versions: {
            "1.0.0": { version: "1.0.0" },
            "1.1.0": { version: "1.1.0" },
            "1.2.0": { version: "1.2.0" },
            "2.0.0-rc.1": { version: "2.0.0-rc.1" },
        },
    };

    it("returns the `latest` dist-tag when spec is undefined", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, undefined)).toBe("1.2.0");
    });

    it("treats 'latest' identically to undefined", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, "latest")).toBe("1.2.0");
    });

    it("resolves dist-tag aliases", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, "next")).toBe("2.0.0-rc.1");
    });

    it("returns the spec when it's an exact published version", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, "1.1.0")).toBe("1.1.0");
    });

    it("returns the max satisfying version for a semver range", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, "^1.0.0")).toBe("1.2.0");
    });

    it("returns undefined when nothing satisfies the range", () => {
        expect.assertions(1);

        expect(resolveVersionRange(packument, "^3.0.0")).toBeUndefined();
    });
});

describe(clearPackumentCache, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-packument-clear-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("returns 0 when the directory does not exist", () => {
        expect.assertions(1);

        expect(clearPackumentCache()).toBe(0);
    });

    it("removes every cached packument and reports the count", async () => {
        expect.assertions(2);

        stubFetch({ body: samplePackument });

        await getPackument("demo");
        await getPackument("@scope/other");

        const removed = clearPackumentCache();

        expect(removed).toBe(2);
        // Second sweep returns 0 once the directory is empty.
        expect(clearPackumentCache()).toBe(0);
    });
});
