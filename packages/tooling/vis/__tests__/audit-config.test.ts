import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAdvisoryExcluded, isPackageExcluded, readNativeAuditExclusions, syncAcceptedRisksToNativeConfig } from "../src/config/audit-config";

let tmpDir: string;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vis-audit-config-"));
});

afterEach(() => {
    rmSync(tmpDir, { force: true, recursive: true });
});

// --- Readers ---

describe(readNativeAuditExclusions, () => {
    describe("pnpm", () => {
        it("should parse ignoreCves and ignoreGhsas from pnpm-workspace.yaml", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, "pnpm-workspace.yaml"),
                `packages:
  - packages/*

auditConfig:
  ignoreCves:
    - CVE-2022-36313
    - CVE-2023-44270
  ignoreGhsas:
    - GHSA-42xw-2xvc-qx8m
`,
            );

            const result = readNativeAuditExclusions(tmpDir, "pnpm");

            expect(result.ignoredAdvisories).toContain("CVE-2022-36313");
            expect(result.ignoredAdvisories).toContain("GHSA-42xw-2xvc-qx8m");
            expect(result.excludedPackages).toHaveLength(0);
        });

        it("should return empty when no pnpm-workspace.yaml", () => {
            expect.assertions(1);

            const result = readNativeAuditExclusions(tmpDir, "pnpm");

            expect(result.ignoredAdvisories).toHaveLength(0);
        });

        it("should return empty when no auditConfig section", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

            const result = readNativeAuditExclusions(tmpDir, "pnpm");

            expect(result.ignoredAdvisories).toHaveLength(0);
        });
    });

    describe("yarn berry", () => {
        it("should parse npmAuditIgnoreAdvisories and npmAuditExcludePackages", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, ".yarnrc.yml"),
                `nodeLinker: node-modules

npmAuditIgnoreAdvisories:
  - "1234567"
  - "GHSA-42xw-2xvc-qx8m"

npmAuditExcludePackages:
  - "debug"
  - "@scope/*"
`,
            );

            const result = readNativeAuditExclusions(tmpDir, "yarn");

            expect(result.ignoredAdvisories).toContain("GHSA-42xw-2xvc-qx8m");
            expect(result.excludedPackages).toContain("debug");
            expect(result.excludedPackages).toContain("@scope/*");
        });

        it("should return empty when no .yarnrc.yml", () => {
            expect.assertions(2);

            const result = readNativeAuditExclusions(tmpDir, "yarn");

            expect(result.ignoredAdvisories).toHaveLength(0);
            expect(result.excludedPackages).toHaveLength(0);
        });
    });

    describe("npm/bun", () => {
        it("should return empty for npm", () => {
            expect.assertions(2);

            const result = readNativeAuditExclusions(tmpDir, "npm");

            expect(result.ignoredAdvisories).toHaveLength(0);
            expect(result.excludedPackages).toHaveLength(0);
        });

        it("should return empty for bun", () => {
            expect.assertions(2);

            const result = readNativeAuditExclusions(tmpDir, "bun");

            expect(result.ignoredAdvisories).toHaveLength(0);
            expect(result.excludedPackages).toHaveLength(0);
        });
    });
});

// --- Matching helpers ---

describe(isAdvisoryExcluded, () => {
    const exclusions = { excludedPackages: [], ignoredAdvisories: ["CVE-2022-36313", "GHSA-*"] };

    it("should match exact advisory ID", () => {
        expect.assertions(1);
        expect(isAdvisoryExcluded("CVE-2022-36313", exclusions)).toBe(true);
    });

    it("should match glob patterns", () => {
        expect.assertions(1);
        expect(isAdvisoryExcluded("GHSA-abcd-1234-wxyz", exclusions)).toBe(true);
    });

    it("should not match unrelated IDs", () => {
        expect.assertions(1);
        expect(isAdvisoryExcluded("CVE-2099-99999", exclusions)).toBe(false);
    });
});

describe(isPackageExcluded, () => {
    const exclusions = { excludedPackages: ["debug", "@scope/*"], ignoredAdvisories: [] };

    it("should match exact package name", () => {
        expect.assertions(1);
        expect(isPackageExcluded("debug", exclusions)).toBe(true);
    });

    it("should match glob patterns", () => {
        expect.assertions(1);
        expect(isPackageExcluded("@scope/utils", exclusions)).toBe(true);
    });

    it("should not match unrelated packages", () => {
        expect.assertions(1);
        expect(isPackageExcluded("express", exclusions)).toBe(false);
    });
});

// --- Writers ---

describe(syncAcceptedRisksToNativeConfig, () => {
    describe("pnpm", () => {
        it("should add auditConfig section to pnpm-workspace.yaml", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

            const actions = syncAcceptedRisksToNativeConfig("pnpm", tmpDir, ["CVE-2022-36313", "GHSA-abcd-1234-wxyz"]);

            expect(actions).toHaveLength(2);

            const content = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(content).toContain("CVE-2022-36313");
            expect(content).toContain("GHSA-abcd-1234-wxyz");
        });
    });

    describe("yarn", () => {
        it("should add npmAuditIgnoreAdvisories to .yarnrc.yml", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\n");

            const actions = syncAcceptedRisksToNativeConfig("yarn", tmpDir, ["CVE-2022-36313"]);

            expect(actions[0]).toContain("1 advisory");

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("CVE-2022-36313");
        });
    });

    describe("npm", () => {
        it("should note that npm has no native mechanism", () => {
            expect.assertions(1);

            const actions = syncAcceptedRisksToNativeConfig("npm", tmpDir, ["CVE-2022-36313"]);

            expect(actions[0]).toContain("no native audit exclusion config");
        });
    });

    describe("bun", () => {
        it("should suggest CLI flags for bun", () => {
            expect.assertions(1);

            const actions = syncAcceptedRisksToNativeConfig("bun", tmpDir, ["CVE-2022-36313"]);

            expect(actions[0]).toContain("--ignore");
        });
    });

    it("should handle empty advisory list", () => {
        expect.assertions(1);

        const actions = syncAcceptedRisksToNativeConfig("pnpm", tmpDir, []);

        expect(actions[0]).toContain("No advisory IDs");
    });
});
