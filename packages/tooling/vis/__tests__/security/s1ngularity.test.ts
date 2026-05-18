import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearPackumentCache } from "../../src/security/marshalls/packument";
import { findNewestPriorStable, runS1ngularityMarshall } from "../../src/security/marshalls/s1ngularity";

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

const packumentWith = (
    versions: Record<string, { hasProvenance?: boolean; scripts?: Record<string, string> }>,
): Record<string, unknown> => {
    return {
        name: "demo",
        versions: Object.fromEntries(
            Object.entries(versions).map(([version, info]) => [
                version,
                {
                    dist: info.hasProvenance === true ? { attestations: { provenance: { foo: "bar" } } } : {},
                    scripts: info.scripts,
                    version,
                },
            ]),
        ),
    };
};

describe(findNewestPriorStable, () => {
    it("returns the newest stable version strictly below the installed one", () => {
        expect.assertions(1);

        const packument = packumentWith({ "1.0.0": {}, "1.1.0": {}, "1.2.0": {}, "2.0.0": {} }) as never;

        expect(findNewestPriorStable(packument, "1.2.0")).toBe("1.1.0");
    });

    it("skips prereleases when picking the baseline", () => {
        expect.assertions(1);

        const packument = packumentWith({ "1.0.0": {}, "1.1.0-rc.1": {}, "1.2.0": {} }) as never;

        expect(findNewestPriorStable(packument, "1.2.0")).toBe("1.0.0");
    });

    it("returns undefined when the installed version is not valid semver", () => {
        expect.assertions(1);

        const packument = packumentWith({ "1.0.0": {} }) as never;

        expect(findNewestPriorStable(packument, "latest")).toBeUndefined();
    });
});

describe(runS1ngularityMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-s1ngularity-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags a version that introduced a postinstall AND dropped provenance (the s1ngularity shape)", async () => {
        expect.assertions(2);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false, scripts: { postinstall: "node telemetry.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toHaveLength(1);
        expect(findings[0]).toStrictEqual({
            hookChanges: [{ command: "node telemetry.js", hook: "postinstall", kind: "introduced" }],
            packageName: "demo",
            priorVersion: "1.0.0",
            trustSignal: "provenance-dropped",
            version: "1.1.0",
        });
    });

    it("flags a CHANGED install command when provenance is also dropped", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true, scripts: { postinstall: "node-gyp rebuild" } },
                "1.1.0": { hasProvenance: false, scripts: { postinstall: "node evil.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings[0]?.hookChanges).toStrictEqual([{ command: "node evil.js", hook: "postinstall", kind: "changed" }]);
    });

    it("does NOT flag an install-script change when provenance is retained (provenance marshall's job, not this one)", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: true, scripts: { postinstall: "node telemetry.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("does NOT flag a provenance drop with no install-script change (that is the provenance marshall)", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("does NOT flag when an unchanged postinstall is carried forward alongside a provenance drop", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true, scripts: { postinstall: "node build.js" } },
                "1.1.0": { hasProvenance: false, scripts: { postinstall: "node build.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("does NOT flag a brand-new package with no prior stable version", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: false, scripts: { postinstall: "node telemetry.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("ignores a prerelease-only history (no stable baseline to regress from)", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: false, scripts: { postinstall: "node telemetry.js" } },
                "1.0.0-rc.1": { hasProvenance: true },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.0.0" }]);

        expect(findings).toStrictEqual([]);
    });

    it("respects the allowlist", async () => {
        expect.assertions(1);

        stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false, scripts: { postinstall: "node telemetry.js" } },
            }),
        });

        const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }], { allowlist: ["demo"] });

        expect(findings).toStrictEqual([]);
    });

    it("returns an empty array when MARSHALL_DISABLE_S1NGULARITY is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_S1NGULARITY;
        const fetchSpy = stubFetch({
            body: packumentWith({
                "1.0.0": { hasProvenance: true },
                "1.1.0": { hasProvenance: false, scripts: { postinstall: "node telemetry.js" } },
            }),
        });

        try {
            process.env.MARSHALL_DISABLE_S1NGULARITY = "1";

            const findings = await runS1ngularityMarshall([{ name: "demo", version: "1.1.0" }]);

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_S1NGULARITY;
            } else {
                process.env.MARSHALL_DISABLE_S1NGULARITY = previous;
            }
        }
    });
});
