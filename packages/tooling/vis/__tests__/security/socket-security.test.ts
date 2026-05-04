import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AcceptedRisk, PackageReportData, PackageScore } from "../../src/security/socket-security";

// Mock homedir before importing the module under test
const TEST_HOME = join(tmpdir(), `vis-socket-test-${String(process.pid)}-${String(Date.now())}`);

vi.mock(import("node:os"), async (importOriginal) => {
    const original = await importOriginal<typeof import("node:os")>();

    return { ...original, homedir: () => TEST_HOME };
});

const {
    buildSocketOptions,
    calculateOverallScore,
    clearSocketCache,
    findAcceptedRisk,
    formatAcceptedRiskSnippet,
    formatReportDetailed,
    formatReportSummary,
    formatSecurityOverview,
    isPackageReportData,
    scoreColor,
    scoreLabel,
} = await import("../../src/security/socket-security");

// --- Helpers ---

const makeScore = (overrides: Partial<PackageScore> = {}): PackageScore => {
    return {
        license: 0.8,
        maintenance: 0.7,
        overall: 0.75,
        quality: 0.9,
        supplyChain: 0.6,
        vulnerability: 0.85,
        ...overrides,
    };
};

const makeReport = (overrides: Partial<PackageReportData> = {}): PackageReportData => {
    return {
        alerts: [],
        author: ["test-author"],
        id: "pkg:npm/test-pkg@1.0.0",
        license: "MIT",
        name: "test-pkg",
        score: makeScore(),
        size: 1024,
        type: "npm",
        version: "1.0.0",
        ...overrides,
    };
};

// --- Pure function tests ---

describe("isPackageReportData", () => {
    it("should return true for valid report data", () => {
        expect.assertions(1);
        expect(isPackageReportData(makeReport())).toBe(true);
    });

    it("should return false for non-npm type", () => {
        expect.assertions(1);
        expect(isPackageReportData({ ...makeReport(), type: "pypi" })).toBe(false);
    });

    it("should return false for missing fields", () => {
        expect.assertions(2);
        expect(isPackageReportData({})).toBe(false);
        expect(isPackageReportData(null)).toBe(false);
    });
});

describe("calculateOverallScore", () => {
    it("should average the five score components", () => {
        expect.assertions(1);

        const score = { license: 1, maintenance: 0.5, quality: 0.5, supplyChain: 0.5, vulnerability: 0.5 };

        expect(calculateOverallScore(score)).toBe(0.6);
    });

    it("should handle all zeros", () => {
        expect.assertions(1);
        expect(calculateOverallScore({ license: 0, maintenance: 0, quality: 0, supplyChain: 0, vulnerability: 0 })).toBe(0);
    });

    it("should handle all ones", () => {
        expect.assertions(1);
        expect(calculateOverallScore({ license: 1, maintenance: 1, quality: 1, supplyChain: 1, vulnerability: 1 })).toBe(1);
    });
});

describe("scoreLabel", () => {
    it("should return correct labels for score ranges", () => {
        expect.assertions(5);
        expect(scoreLabel(0.9)).toBe("excellent");
        expect(scoreLabel(0.7)).toBe("good");
        expect(scoreLabel(0.5)).toBe("fair");
        expect(scoreLabel(0.3)).toBe("poor");
        expect(scoreLabel(0.1)).toBe("critical");
    });
});

describe("scoreColor", () => {
    it("should return green for high scores", () => {
        expect.assertions(1);
        expect(scoreColor(0.8)).toBe("green");
    });

    it("should return yellow for medium scores", () => {
        expect.assertions(1);
        expect(scoreColor(0.5)).toBe("yellow");
    });

    it("should return red for low scores", () => {
        expect.assertions(1);
        expect(scoreColor(0.2)).toBe("red");
    });
});

describe("formatReportSummary", () => {
    it("should format a one-line summary", () => {
        expect.assertions(2);

        const summary = formatReportSummary(makeReport());

        expect(summary).toContain("test-pkg@1.0.0");
        expect(summary).toContain("75%");
    });

    it("should include alert count when present", () => {
        expect.assertions(1);

        const report = makeReport({
            alerts: [{ category: "security", key: "a1", severity: "high", type: "prototype-pollution" }],
        });

        expect(formatReportSummary(report)).toContain("1 alert");
    });

    it("should handle scoped packages", () => {
        expect.assertions(1);

        const report = makeReport({ name: "core", namespace: "@babel" });

        expect(formatReportSummary(report)).toContain("@babel/core@1.0.0");
    });
});

describe("formatReportDetailed", () => {
    it("should include score breakdown", () => {
        expect.assertions(3);

        const detailed = formatReportDetailed(makeReport());

        expect(detailed).toContain("Overall Score:");
        expect(detailed).toContain("Supply Chain:");
        expect(detailed).toContain("License: MIT");
    });

    it("should show alerts when present", () => {
        expect.assertions(2);

        const report = makeReport({
            alerts: [
                {
                    category: "security",
                    key: "a1",
                    props: { cveId: "CVE-2024-1234", lastPublish: "2024-01-01" },
                    severity: "critical",
                    type: "prototype-pollution",
                },
            ],
        });
        const detailed = formatReportDetailed(report);

        expect(detailed).toContain("[CRITICAL]");
        expect(detailed).toContain("CVE-2024-1234");
    });
});

describe("formatSecurityOverview", () => {
    it("should return empty string for no reports", () => {
        expect.assertions(1);
        expect(formatSecurityOverview(new Map())).toBe("");
    });

    it("should show scanned count and alert breakdown", () => {
        expect.assertions(3);

        const reports = new Map<string, PackageReportData>();

        reports.set("a@1", makeReport({ alerts: [{ category: "sec", key: "a", severity: "critical", type: "vuln" }] }));
        reports.set("b@1", makeReport({ alerts: [], name: "b" }));

        const overview = formatSecurityOverview(reports);

        expect(overview).toContain("scanned 2 packages");
        expect(overview).toContain("1 total");
        expect(overview).toContain("1 critical");
    });

    it("should count low-score packages", () => {
        expect.assertions(1);

        const reports = new Map<string, PackageReportData>();

        reports.set("a@1", makeReport({ score: makeScore({ overall: 0.2 }) }));

        const overview = formatSecurityOverview(reports);

        expect(overview).toContain("1 package with low security score");
    });
});

describe("buildSocketOptions", () => {
    it("should return undefined when not enabled", () => {
        expect.assertions(2);
        expect(buildSocketOptions(undefined)).toBeUndefined();
        expect(buildSocketOptions({ enabled: false })).toBeUndefined();
    });

    it("should return options when enabled", () => {
        expect.assertions(2);

        const result = buildSocketOptions({ enabled: true, timeoutMs: 5000 });

        expect(result).toBeDefined();
        expect(result?.timeoutMs).toBe(5000);
    });
});

// --- Accepted risks ---

describe("findAcceptedRisk", () => {
    const risks: Record<string, AcceptedRisk> = {
        "@myorg/*": { acceptedAt: "2026-01-01T00:00:00Z", acceptedScore: 0.2, reason: "internal" },
        lodash: { acceptedAt: "2026-01-01T00:00:00Z", acceptedScore: 0.3, reason: "reviewed" },
        "react@18.0.0": { acceptedAt: "2026-01-01T00:00:00Z", acceptedScore: 0.35, reason: "pinned" },
    };

    it("should match by unversioned name", () => {
        expect.assertions(2);

        const result = findAcceptedRisk("lodash", "4.17.21", risks);

        expect(result).toBeDefined();
        expect(result?.reason).toBe("reviewed");
    });

    it("should match by exact name@version", () => {
        expect.assertions(2);

        const result = findAcceptedRisk("react", "18.0.0", risks);

        expect(result).toBeDefined();
        expect(result?.reason).toBe("pinned");
    });

    it("should not match different version when versioned key exists", () => {
        expect.assertions(1);
        expect(findAcceptedRisk("react", "19.0.0", risks)).toBeUndefined();
    });

    it("should match glob patterns", () => {
        expect.assertions(2);

        const result = findAcceptedRisk("@myorg/utils", "1.0.0", risks);

        expect(result).toBeDefined();
        expect(result?.reason).toBe("internal");
    });

    it("should return undefined for unknown packages", () => {
        expect.assertions(1);
        expect(findAcceptedRisk("unknown-pkg", "1.0.0", risks)).toBeUndefined();
    });

    it("should return undefined when no risks configured", () => {
        expect.assertions(1);
        expect(findAcceptedRisk("lodash", "4.17.21", undefined)).toBeUndefined();
    });
});

describe("formatAcceptedRiskSnippet", () => {
    it("should produce a valid config snippet", () => {
        expect.assertions(3);

        const snippet = formatAcceptedRiskSnippet("lodash", "4.17.21", 0.3, "Reviewed and accepted");

        expect(snippet).toContain('"lodash"');
        expect(snippet).toContain("Reviewed and accepted");
        expect(snippet).toContain("acceptedScore: 0.3");
    });
});

// --- Cache tests ---

describe("socket cache", () => {
    beforeEach(() => {
        mkdirSync(TEST_HOME, { recursive: true });
    });

    afterEach(() => {
        rmSync(TEST_HOME, { force: true, recursive: true });
    });

    it("clearSocketCache should return 0 when no cache exists", () => {
        expect.assertions(1);
        expect(clearSocketCache()).toBe(0);
    });

    it("clearSocketCache should remove cached files", () => {
        expect.assertions(2);

        const cacheDir = join(TEST_HOME, ".vis", "cache", "socket-security");

        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(join(cacheDir, "test@1.0.0.json"), "{}");

        expect(existsSync(join(cacheDir, "test@1.0.0.json"))).toBe(true);

        const deleted = clearSocketCache();

        expect(deleted).toBe(1);
    });
});
