import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache } from "../../src/security/marshalls/packument";
import { normalizeBin, runNewBinMarshall } from "../../src/security/marshalls/new-bin";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const stubFetch = (response: { body?: unknown; status?: number }): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () =>
        Promise.resolve({
            json: async () => Promise.resolve(response.body ?? {}),
            ok: (response.status ?? 200) < 400,
            status: response.status ?? 200,
        }),
    );

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packumentWith = (versions: Record<string, Record<string, string> | string | undefined>): Record<string, unknown> => ({
    name: "demo",
    versions: Object.fromEntries(
        Object.entries(versions).map(([version, bin]) => [
            version,
            {
                bin,
                version,
            },
        ]),
    ),
});

describe(normalizeBin, () => {
    it("returns an empty map when bin is undefined", () => {
        expect.assertions(1);

        expect(normalizeBin(undefined, "demo")).toStrictEqual({});
    });

    it("treats a string as the package-named bin", () => {
        expect.assertions(1);

        expect(normalizeBin("./bin/demo.js", "demo")).toStrictEqual({ demo: "./bin/demo.js" });
    });

    it("strips the scope from the implied bin name", () => {
        expect.assertions(1);

        expect(normalizeBin("./bin/demo.js", "@scope/demo")).toStrictEqual({ demo: "./bin/demo.js" });
    });

    it("returns a shallow copy of a record bin field", () => {
        expect.assertions(2);

        const input = { extra: "./bin/extra.js", main: "./bin/main.js" };
        const normalized = normalizeBin(input, "demo");

        expect(normalized).toStrictEqual(input);
        expect(normalized).not.toBe(input);
    });
});

describe(runNewBinMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-new-bin-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags a bin added in the current version", async () => {
        expect.assertions(2);

        stubFetch({
            body: packumentWith({
                "1.0.0": { foo: "./foo.js" },
                "1.1.0": { bar: "./bar.js", foo: "./foo.js" },
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            fromVersion: "1.0.0",
            newBins: [{ command: "./bar.js", name: "bar" }],
            packageName: "demo",
            toVersion: "1.1.0",
        });
    });

    it("does not flag when bins are unchanged", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { foo: "./foo.js" },
                "1.1.0": { foo: "./foo.js" },
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("handles the string-shorthand bin form on both sides", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": "./old-demo.js",
                "1.1.0": "./demo.js",
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }]);

        // Same bin name on both sides (renamed file != new bin).
        expect(findings).toStrictEqual([]);
    });

    it("respects allowBins to silence known dev tool bins", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { existing: "./e.js" },
                "1.1.0": { existing: "./e.js", tsc: "./tsc.js" },
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }], { allowBins: ["tsc"] });

        expect(findings).toStrictEqual([]);
    });

    it("respects the package allowlist", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": undefined,
                "1.1.0": { fresh: "./f.js" },
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("does not flag a brand-new package (no prior version)", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { fresh: "./f.js" },
            }),
        });

        const findings = await runNewBinMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("short-circuits when MARSHALL_DISABLE_NEW_BIN is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_NEW_BIN;
        const fetchSpy = stubFetch({
            body: packumentWith({
                "1.0.0": undefined,
                "1.1.0": { fresh: "./f.js" },
            }),
        });

        try {
            process.env.MARSHALL_DISABLE_NEW_BIN = "1";

            const findings = await runNewBinMarshall([{ name: "demo", version: "1.1.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_NEW_BIN;
            } else {
                process.env.MARSHALL_DISABLE_NEW_BIN = previous;
            }
        }
    });
});
