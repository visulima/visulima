import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runPackageAgeMarshall } from "../../src/security/marshalls/package-age";
import { clearPackumentCache } from "../../src/security/marshalls/packument";

let homeOverride: string;

vi.mock(import("node:os"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        homedir: () => homeOverride,
    };
});

const NOW = Date.parse("2026-05-16T00:00:00.000Z");
const daysAgo = (days: number): string => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

const stubFetch = (body: unknown, status = 200): ReturnType<typeof vi.fn> => {
    const handler = vi.fn(async () => {
        return {
            json: async () => body ?? {},
            ok: status < 400,
            status,
        };
    });

    vi.stubGlobal("fetch", handler);

    return handler;
};

const packument = (time: Record<string, string>): Record<string, unknown> => {
    return {
        name: "demo",
        time,
        versions: Object.fromEntries(
            Object.keys(time)
                .filter((key) => key !== "created" && key !== "modified")
                .map((version) => [version, { version }]),
        ),
    };
};

describe(runPackageAgeMarshall, () => {
    beforeEach(() => {
        homeOverride = mkdtempSync(join(tmpdir(), "vis-package-age-"));
        clearPackumentCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (existsSync(homeOverride)) {
            rmSync(homeOverride, { force: true, recursive: true });
        }
    });

    it("flags a brand-new package as an error", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(5), created: daysAgo(5), modified: daysAgo(5) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([{ days: 5, kind: "new-package", packageName: "demo", severity: "error" }]);
    });

    it("does not flag a package exactly at the new-package threshold", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(22), created: daysAgo(22), modified: daysAgo(22) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([]);
    });

    it("flags an unmaintained package as a warning", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(900), created: daysAgo(900), modified: daysAgo(400) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([{ days: 400, kind: "unmaintained", packageName: "demo", severity: "warning" }]);
    });

    it("new-package takes precedence over unmaintained", async () => {
        expect.assertions(1);

        stubFetch(packument({ "0.0.1": daysAgo(3), created: daysAgo(3), modified: daysAgo(3) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "0.0.1" }], { now: () => NOW });

        expect(findings[0]?.kind).toBe("new-package");
    });

    it("does not flag a healthy long-lived package", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(800), created: daysAgo(800), modified: daysAgo(10) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([]);
    });

    it("falls back to version timestamps when created/modified are absent", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(2) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([{ days: 2, kind: "new-package", packageName: "demo", severity: "error" }]);
    });

    it("honors custom thresholds", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(50), created: daysAgo(50), modified: daysAgo(50) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], {
            now: () => NOW,
            thresholds: { newPackageDays: 60, unmaintainedDays: 365 },
        });

        expect(findings[0]?.kind).toBe("new-package");
    });

    it("respects the package allowlist", async () => {
        expect.assertions(1);

        stubFetch(packument({ "1.0.0": daysAgo(1), created: daysAgo(1), modified: daysAgo(1) }));

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { allowlist: ["demo"], now: () => NOW });

        expect(findings).toStrictEqual([]);
    });

    it("returns nothing on a 404 packument", async () => {
        expect.assertions(1);

        stubFetch({}, 404);

        const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

        expect(findings).toStrictEqual([]);
    });

    it("short-circuits when MARSHALL_DISABLE_PACKAGE_AGE is set", async () => {
        expect.assertions(2);

        const previous = process.env.MARSHALL_DISABLE_PACKAGE_AGE;
        const fetchSpy = stubFetch(packument({ "1.0.0": daysAgo(1), created: daysAgo(1) }));

        try {
            process.env.MARSHALL_DISABLE_PACKAGE_AGE = "1";

            const findings = await runPackageAgeMarshall([{ name: "demo", version: "1.0.0" }], { now: () => NOW });

            expect(findings).toStrictEqual([]);
            expect(fetchSpy).not.toHaveBeenCalled();
        } finally {
            if (previous === undefined) {
                delete process.env.MARSHALL_DISABLE_PACKAGE_AGE;
            } else {
                process.env.MARSHALL_DISABLE_PACKAGE_AGE = previous;
            }
        }
    });
});
