import { describe, expect, it } from "vitest";

import { applyFilter, filterFindingsByPattern, parseFilterPatterns } from "../src/commands/doctor/filter";
import type { DoctorResults } from "../src/commands/doctor/sections";
import type { DoctorFinding } from "../src/tui/components/doctor/findings";

const baseResults: DoctorResults = {
    duplicates: [
        { name: "react", versions: ["17.0.0", "18.0.0"] } as DoctorResults["duplicates"][number],
        { name: "lodash", versions: ["4.0.0", "4.17.21"] } as DoctorResults["duplicates"][number],
    ],
    elapsedMs: 0,
    installedCount: 0,
    optimizations: [
        { category: "micro-utility", packageName: "is-array", replacement: "Array.isArray" } as DoctorResults["optimizations"][number],
        { category: "native", packageName: "left-pad", replacement: "String.prototype.padStart" } as DoctorResults["optimizations"][number],
    ],
    outdated: [
        { catalogName: "default", currentRange: "1.0", newRange: "1.1", packageName: "react", targetVersion: "1.1", updateType: "minor", vulnerabilities: [] } as DoctorResults["outdated"][number],
        { catalogName: "default", currentRange: "1.0", newRange: "1.1", packageName: "@types/node", targetVersion: "1.1", updateType: "minor", vulnerabilities: [] } as DoctorResults["outdated"][number],
    ],
    runtime: [],
    sections: new Set(["dependencies", "optimization", "runtime", "security"]),
    socketIssues: { alerts: 0, lowScore: 0 },
    vulnCount: 0,
    workspaceCount: 0,
};

describe(parseFilterPatterns, () => {
    it("returns empty list for undefined or empty", () => {
        expect(parseFilterPatterns(undefined)).toEqual([]);
        expect(parseFilterPatterns("")).toEqual([]);
    });

    it("compiles literal package names to anchored regex", () => {
        const [pattern] = parseFilterPatterns("lodash");

        expect(pattern!.test("lodash")).toBe(true);
        expect(pattern!.test("lodash.merge")).toBe(false);
    });

    it("compiles globs with * to match any segment", () => {
        const [pattern] = parseFilterPatterns("@types/*");

        expect(pattern!.test("@types/node")).toBe(true);
        expect(pattern!.test("@types/react-dom")).toBe(true);
        expect(pattern!.test("react")).toBe(false);
    });

    it("splits comma-separated patterns", () => {
        const patterns = parseFilterPatterns("react,@types/*");

        expect(patterns).toHaveLength(2);
    });

    it("matches case-insensitively", () => {
        const [pattern] = parseFilterPatterns("REACT");

        expect(pattern!.test("react")).toBe(true);
    });
});

describe(applyFilter, () => {
    it("returns the same results when no patterns are passed", () => {
        const out = applyFilter(baseResults, []);

        expect(out).toBe(baseResults);
    });

    it("narrows outdated/duplicates/optimizations by package name", () => {
        const patterns = parseFilterPatterns("react");
        const out = applyFilter(baseResults, patterns);

        expect(out.outdated.map((o) => o.packageName)).toEqual(["react"]);
        expect(out.duplicates.map((d) => d.name)).toEqual(["react"]);
        expect(out.optimizations).toHaveLength(0);
    });

    it("supports glob patterns", () => {
        const patterns = parseFilterPatterns("@types/*");
        const out = applyFilter(baseResults, patterns);

        expect(out.outdated.map((o) => o.packageName)).toEqual(["@types/node"]);
        expect(out.duplicates).toHaveLength(0);
    });
});

describe(filterFindingsByPattern, () => {
    const makeFinding = (kind: DoctorFinding["kind"], name: string): DoctorFinding => {
        switch (kind) {
            case "duplicate": {
                return {
                    id: `dup:${name}`,
                    kind: "duplicate",
                    pkg: { name, versions: [] } as never,
                    section: "dependencies",
                    severity: "warn",
                    title: name,
                };
            }
            case "outdated": {
                return {
                    entry: { packageName: name } as never,
                    id: `out:${name}`,
                    kind: "outdated",
                    section: "dependencies",
                    severity: "warn",
                    title: name,
                };
            }
            case "runtime": {
                return {
                    diagnostic: { id: name, message: name, status: "warn" },
                    id: `rt:${name}`,
                    kind: "runtime",
                    section: "runtime",
                    severity: "warn",
                    title: name,
                };
            }
            default: {
                throw new Error(`unhandled kind ${String(kind)}`);
            }
        }
    };

    it("passes runtime findings through regardless of patterns", () => {
        const findings = [makeFinding("runtime", "node-version"), makeFinding("outdated", "lodash")];
        const out = filterFindingsByPattern(findings, parseFilterPatterns("react"));

        expect(out.map((f) => f.id)).toEqual(["rt:node-version"]);
    });

    it("returns the input list unchanged when no patterns", () => {
        const findings = [makeFinding("outdated", "react"), makeFinding("duplicate", "lodash")];
        const out = filterFindingsByPattern(findings, []);

        expect(out).toEqual(findings);
    });
});
