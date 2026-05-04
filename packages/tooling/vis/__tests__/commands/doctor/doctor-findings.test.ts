import { describe, expect, expectTypeOf, it } from "vitest";

import type { DoctorResults, SectionId } from "../../../src/commands/doctor/sections";
import { SECTION_IDS } from "../../../src/commands/doctor/sections";
import type { RuntimeDiagnostic } from "../../../src/runtime/runtime-diagnostics";
import type { DuplicatePackage } from "../../../src/security/dependency-scan";
import type { DoctorFinding } from "../../../src/tui/components/doctor/findings";
import { flattenFindings, SECTION_LABELS } from "../../../src/tui/components/doctor/findings";
import type { OptimizeEntry } from "../../../src/tui/components/optimize/OptimizeStore";
import type { OutdatedEntry } from "../../../src/util/catalog";

const buildResults = (overrides: Partial<DoctorResults> = {}): DoctorResults => {
    return {
        duplicates: [],
        elapsedMs: 0,
        installedCount: 0,
        optimizations: [],
        outdated: [],
        runtime: [],
        sections: new Set<SectionId>(SECTION_IDS),
        socketIssues: { alerts: 0, lowScore: 0 },
        vulnCount: 0,
        workspaceCount: 0,
        ...overrides,
    };
};

const outdated = (overrides: Partial<OutdatedEntry> = {}): OutdatedEntry => {
    return {
        catalogName: "default",
        currentRange: "^1.0.0",
        newRange: "^2.0.0",
        packageName: "lodash",
        targetVersion: "2.0.0",
        updateType: "major",
        ...overrides,
    };
};

const dup = (name: string, versions: string[]): DuplicatePackage => { return { name, versions }; };

const opt = (overrides: Partial<OptimizeEntry> = {}): OptimizeEntry => {
    return {
        category: "preferred",
        hasCodemod: false,
        packageName: "is-regex",
        replacement: "@socketregistry/is-regex",
        ...overrides,
    };
};

const runtime = (overrides: Partial<RuntimeDiagnostic> = {}): RuntimeDiagnostic => {
    return {
        id: "tty",
        message: "TTY check",
        status: "warn",
        ...overrides,
    };
};

describe(flattenFindings, () => {
    it("emits one row per section per item with stable ids", () => {
        expect.assertions(4);

        const findings = flattenFindings(
            buildResults({
                duplicates: [dup("react", ["18.0.0", "18.2.0"])],
                optimizations: [opt({ packageName: "lodash.get" })],
                outdated: [outdated()],
                runtime: [runtime({ id: "watchers", message: "many watchers" })],
            }),
        );

        const ids = findings.map((f) => f.id);

        expect(ids).toContain("outdated:lodash");
        expect(ids).toContain("duplicate:react");
        expect(ids).toContain("opt:lodash.get");
        expect(ids).toContain("runtime:watchers");
    });

    it("sorts sections in declaration order then severity", () => {
        expect.assertions(1);

        const findings = flattenFindings(
            buildResults({
                outdated: [
                    outdated({
                        currentRange: "^1.0.0",
                        newRange: "^1.0.5",
                        packageName: "patch-pkg",
                        updateType: "patch",
                        vulnerabilities: [
                            {
                                fixedVersions: ["2.0.0"],
                                id: "GHSA-aaaa",
                                severity: "HIGH",
                                summary: "uh oh",
                            },
                        ],
                    }),
                ],
            }),
        );

        const sections = findings.map((f) => f.section);

        expect(sections.indexOf("dependencies")).toBeLessThan(sections.indexOf("security"));
    });

    it("demotes acked vulnerabilities from error to warn (socket already warn)", () => {
        expect.assertions(2);

        const acked = outdated({
            acceptedRisk: { acceptedAt: "2025-01-01T00:00:00Z", acceptedScore: 0.5, reason: "tracked upstream" },
            packageName: "risky",
            socketReport: {
                alerts: [{ severity: "high", type: "supplyChainRisk" }],
                license: "MIT",
                score: { license: 1, maintenance: 0.5, overall: 0.4, quality: 0.5, supplyChain: 0.4, vulnerability: 0.5 },
            } as never,
            vulnerabilities: [
                { fixedVersions: ["2.0.0"], id: "GHSA-bbbb", severity: "CRITICAL", summary: "" },
            ],
        });

        const findings = flattenFindings(buildResults({ outdated: [acked] }));
        const vuln = findings.find((f) => f.kind === "vulnerability");
        const socket = findings.find((f) => f.kind === "socket");

        expect(vuln?.severity).toBe("warn");
        expect(socket?.severity).toBe("warn");
    });

    it("only surfaces warn runtime diagnostics — drops ok and skip", () => {
        expect.assertions(1);

        const findings = flattenFindings(
            buildResults({
                runtime: [
                    runtime({ id: "ok-check", message: "all good", status: "ok" }),
                    runtime({ id: "warn-check", message: "watch out", status: "warn" }),
                    runtime({ id: "skip-check", message: "n/a", status: "skip" }),
                ],
            }),
        );

        const ids = findings.filter((f) => f.kind === "runtime").map((f) => f.id);

        expect(ids).toEqual(["runtime:warn-check"]);
    });

    it("respects section selection — does not emit findings for sections not in the set", () => {
        expect.assertions(1);

        const findings = flattenFindings(
            buildResults({
                outdated: [outdated()],
                sections: new Set<SectionId>(["security"]),
            }),
        );

        expect(findings.find((f: DoctorFinding) => f.kind === "outdated")).toBeUndefined();
    });

    it("exposes a label for every section id", () => {
        // SECTION_IDS has 4 entries (dependencies, security, optimization, runtime).
        expect.assertions(4);

        for (const id of SECTION_IDS) {
            expectTypeOf(SECTION_LABELS[id]).toBeString();

            expect(SECTION_LABELS[id].length).toBeGreaterThan(0);
        }
    });
});
