import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchChangelog } from "../../src/dlx/changelog";
import { gatherPackageInfo } from "../../src/dlx/package-info";
import type { Packument } from "../../src/security/marshalls/packument";
import { getPackument, resolveVersionRange } from "../../src/security/marshalls/packument";
import type { PackageAlert, PackageReportData } from "../../src/security/socket-security";
import { calculateOverallScore, fetchSocketReports } from "../../src/security/socket-security";

vi.mock(import("../../src/security/marshalls/packument"), () => {
    return { getPackument: vi.fn(), resolveVersionRange: vi.fn() };
});

vi.mock(import("../../src/security/socket-security"), () => {
    return {
        calculateOverallScore: vi.fn(() => 0.5),
        DEFAULT_LOW_SCORE_THRESHOLD: 0.4,
        fetchSocketReports: vi.fn(),
    };
});

vi.mock(import("../../src/dlx/changelog"), () => {
    return { fetchChangelog: vi.fn() };
});

const mockedGetPackument = vi.mocked(getPackument);
const mockedResolveVersionRange = vi.mocked(resolveVersionRange);
const mockedFetchSocketReports = vi.mocked(fetchSocketReports);
const mockedCalculateOverallScore = vi.mocked(calculateOverallScore);
const mockedFetchChangelog = vi.mocked(fetchChangelog);

const makePackument = (versionEntry: Packument["versions"][string]): Packument => {
    return {
        name: "demo",
        versions: { [versionEntry.version]: versionEntry },
    };
};

const makeAlert = (overrides: Partial<PackageAlert> = {}): PackageAlert => {
    return { category: "supplyChainRisk", key: "k", severity: "high", type: "networkAccess", ...overrides };
};

const makeReport = (overrides: Partial<PackageReportData> = {}): PackageReportData => {
    return {
        alerts: [],
        author: ["someone"],
        id: "demo@1.0.0",
        license: "MIT",
        name: "demo",
        score: { license: 1, maintenance: 1, overall: 0.84, quality: 1, supplyChain: 1, vulnerability: 1 },
        size: 4096,
        type: "npm",
        version: "1.0.0",
        ...overrides,
    };
};

describe(gatherPackageInfo, () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedFetchChangelog.mockResolvedValue(undefined);
        mockedResolveVersionRange.mockReturnValue("1.0.0");
    });

    it("returns undefined when the packument cannot be resolved", async () => {
        expect.assertions(2);

        mockedGetPackument.mockResolvedValue(undefined);

        const info = await gatherPackageInfo({ name: "demo", now: 0 });

        expect(info).toBeUndefined();
        expect(mockedResolveVersionRange).not.toHaveBeenCalled();
    });

    it("returns undefined when getPackument throws", async () => {
        expect.assertions(1);

        mockedGetPackument.mockRejectedValue(new Error("network"));

        const info = await gatherPackageInfo({ name: "demo", now: 0 });

        expect(info).toBeUndefined();
    });

    it("returns undefined when no version satisfies the spec", async () => {
        expect.assertions(1);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedResolveVersionRange.mockReturnValue(undefined);

        const info = await gatherPackageInfo({ name: "demo", now: 0, spec: "99" });

        expect(info).toBeUndefined();
    });

    it("passes offline through to getPackument and skips the security fetch", async () => {
        expect.assertions(4);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));

        const info = await gatherPackageInfo({ name: "demo", now: 0, offline: true, socketToken: "tok" });

        expect(mockedGetPackument).toHaveBeenCalledWith("demo", expect.objectContaining({ offline: true }));
        expect(mockedFetchSocketReports).not.toHaveBeenCalled();
        expect(info?.security.available).toBe(false);
        expect(info?.security.score).toBeUndefined();
    });

    it("skips the security fetch when no socket token is configured", async () => {
        expect.assertions(2);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));

        const info = await gatherPackageInfo({ name: "demo", now: 0 });

        expect(mockedFetchSocketReports).not.toHaveBeenCalled();
        expect(info?.security.available).toBe(false);
    });

    it("degrades gracefully when the security fetch throws", async () => {
        expect.assertions(2);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedFetchSocketReports.mockRejectedValue(new Error("socket down"));

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(info?.security.available).toBe(false);
        expect(info?.security.alerts).toStrictEqual([]);
    });

    it("derives size, permissions, and a 0–100 score from a full report", async () => {
        expect.assertions(6);

        mockedGetPackument.mockResolvedValue(
            makePackument({
                bin: { demo: "./cli.js", "demo-extra": "./extra.js" },
                dist: { fileCount: 12, tarball: "https://r/demo.tgz", unpackedSize: 99_999 },
                scripts: { build: "tsc", postinstall: "node setup.js" },
                version: "1.0.0",
            }),
        );
        mockedFetchSocketReports.mockResolvedValue(new Map([["demo@1.0.0", makeReport({ alerts: [makeAlert()] })]]));

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(info?.size).toStrictEqual({ fileCount: 12, tarballBytes: 4096, unpackedBytes: 99_999 });
        expect(info?.permissions.bins).toStrictEqual(["demo", "demo-extra"]);
        expect(info?.permissions.lifecycleScripts).toStrictEqual(["postinstall"]);
        expect(info?.permissions.capabilities).toStrictEqual(["network"]);
        expect(info?.security.available).toBe(true);
        expect(info?.security.score).toBe(84);
    });

    it("labels a string bin as the default and ignores unknown alert types", async () => {
        expect.assertions(2);

        mockedGetPackument.mockResolvedValue(makePackument({ bin: "./cli.js", version: "1.0.0" }));
        mockedFetchSocketReports.mockResolvedValue(new Map([["demo@1.0.0", makeReport({ alerts: [makeAlert({ type: "somethingUnmapped" })] })]]));

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(info?.permissions.bins).toStrictEqual(["(default)"]);
        expect(info?.permissions.capabilities).toStrictEqual([]);
    });

    it("dedupes and sorts high/critical alert keys and drops low/medium", async () => {
        expect.assertions(1);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedFetchSocketReports.mockResolvedValue(
            new Map([
                [
                    "demo@1.0.0",
                    makeReport({
                        alerts: [
                            makeAlert({ key: "zeta", severity: "critical" }),
                            makeAlert({ key: "alpha", severity: "high" }),
                            makeAlert({ key: "alpha", severity: "high" }),
                            makeAlert({ key: "ignored", severity: "low" }),
                            makeAlert({ key: "ignored-medium", severity: "medium" }),
                        ],
                    }),
                ],
            ]),
        );

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(info?.security.highSeverityKeys).toStrictEqual(["alpha", "zeta"]);
    });

    it("falls back to a name/version match when the report map is keyed differently", async () => {
        expect.assertions(1);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedFetchSocketReports.mockResolvedValue(
            new Map([["weird-key", makeReport({ score: { license: 1, maintenance: 1, overall: 0.5, quality: 1, supplyChain: 1, vulnerability: 1 } })]]),
        );

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(info?.security.score).toBe(50);
    });

    it("computes the overall score when the report omits it", async () => {
        expect.assertions(2);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedFetchSocketReports.mockResolvedValue(
            new Map([
                [
                    "demo@1.0.0",
                    makeReport({
                        score: { license: 1, maintenance: 1, overall: undefined as unknown as number, quality: 1, supplyChain: 1, vulnerability: 1 },
                    }),
                ],
            ]),
        );

        const info = await gatherPackageInfo({ name: "demo", now: 0, socketToken: "tok" });

        expect(mockedCalculateOverallScore).toHaveBeenCalledTimes(1);
        expect(info?.security.score).toBe(50);
    });

    it("attaches a resolved changelog", async () => {
        expect.assertions(1);

        mockedGetPackument.mockResolvedValue(makePackument({ version: "1.0.0" }));
        mockedFetchChangelog.mockResolvedValue({ lines: ["- fix: a thing"], source: "package-file", version: "1.0.0" });

        const info = await gatherPackageInfo({ name: "demo", now: 0 });

        expect(info?.changelog).toStrictEqual({ lines: ["- fix: a thing"], source: "package-file", version: "1.0.0" });
    });
});
