import { describe, expect, it } from "vitest";

import type { Finding } from "../../../src/lint-fmt/config-types";
import { emitSarif } from "../../../src/lint-fmt/reporters/sarif";

const baseFinding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        adapter: "eslint",
        column: 5,
        file: "/repo/src/a.ts",
        fixable: false,
        line: 10,
        message: "Unexpected `any`",
        ruleId: "no-explicit-any",
        severity: "error",
        ...overrides,
    };
};

describe(emitSarif, () => {
    it("renders the SARIF envelope with version + schema", () => {
        expect.assertions(2);

        const out = JSON.parse(emitSarif({ runs: [] })) as { $schema: string; version: string };

        expect(out.version).toBe("2.1.0");
        expect(out.$schema).toMatch(/sarif-2\.1\.0/);
    });

    it("emits one run per adapter with results", () => {
        expect.assertions(3);

        const out = JSON.parse(emitSarif({
            runs: [
                { adapter: "eslint", findings: [baseFinding()] },
                { adapter: "oxlint", findings: [] },
            ],
        })) as { runs: { results: unknown[]; tool: { driver: { name: string } } }[] };

        expect(out.runs).toHaveLength(2);
        expect(out.runs[0]!.tool.driver.name).toBe("eslint");
        expect(out.runs[1]!.results).toHaveLength(0);
    });

    it("maps severities to SARIF levels", () => {
        expect.assertions(3);

        const out = JSON.parse(emitSarif({
            runs: [
                {
                    adapter: "eslint",
                    findings: [
                        baseFinding({ severity: "error" }),
                        baseFinding({ line: 11, severity: "warning" }),
                        baseFinding({ line: 12, severity: "info" }),
                    ],
                },
            ],
        })) as { runs: { results: { level: string }[] }[] };

        const levels = out.runs[0]!.results.map((r) => r.level);

        expect(levels).toContain("error");
        expect(levels).toContain("warning");
        expect(levels).toContain("note");
    });

    it("relativises file paths against workspaceRoot via SRCROOT", () => {
        expect.assertions(2);

        const out = JSON.parse(emitSarif({
            runs: [{ adapter: "eslint", findings: [baseFinding({ file: "/repo/src/a.ts" })] }],
            workspaceRoot: "/repo",
        })) as { runs: { results: { locations: { physicalLocation: { artifactLocation: { uri: string; uriBaseId?: string } } }[] }[] }[] };

        const loc = out.runs[0]!.results[0]!.locations[0]!.physicalLocation.artifactLocation;

        expect(loc.uri).toBe("src/a.ts");
        expect(loc.uriBaseId).toBe("SRCROOT");
    });

    it("keeps absolute paths when outside workspaceRoot", () => {
        expect.assertions(1);

        const out = JSON.parse(emitSarif({
            runs: [{ adapter: "eslint", findings: [baseFinding({ file: "/other/x.ts" })] }],
            workspaceRoot: "/repo",
        })) as { runs: { results: { locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] }[] };

        expect(out.runs[0]!.results[0]!.locations[0]!.physicalLocation.artifactLocation.uri).toBe("/other/x.ts");
    });

    it("includes a region when line/column data is present", () => {
        expect.assertions(2);

        const out = JSON.parse(emitSarif({
            runs: [{ adapter: "eslint", findings: [baseFinding({ column: 5, endColumn: 12, endLine: 11, line: 10 })] }],
        })) as { runs: { results: { locations: { physicalLocation: { region: Record<string, number> } }[] }[] }[] };

        const { region } = out.runs[0]!.results[0]!.locations[0]!.physicalLocation;

        expect(region.startLine).toBe(10);
        expect(region.endColumn).toBe(12);
    });

    it("orders results by file then line for stable diffs", () => {
        expect.assertions(1);

        const findings: Finding[] = [
            baseFinding({ file: "/repo/b.ts", line: 5 }),
            baseFinding({ file: "/repo/a.ts", line: 12 }),
            baseFinding({ file: "/repo/a.ts", line: 3 }),
        ];

        const out = JSON.parse(emitSarif({ runs: [{ adapter: "eslint", findings }] })) as {
            runs: { results: { locations: { physicalLocation: { artifactLocation: { uri: string }; region: { startLine: number } } }[] }[] }[];
        };

        const order = out.runs[0]!.results.map((r) => {
            const { physicalLocation } = (r.locations[0]!);

            return `${physicalLocation.artifactLocation.uri}:${String(physicalLocation.region.startLine)}`;
        });

        expect(order).toStrictEqual(["/repo/a.ts:3", "/repo/a.ts:12", "/repo/b.ts:5"]);
    });

    it("aggregates unique rules into tool.driver.rules", () => {
        expect.assertions(2);

        const out = JSON.parse(emitSarif({
            runs: [{
                adapter: "eslint",
                findings: [
                    baseFinding({ ruleId: "no-explicit-any" }),
                    baseFinding({ line: 11, ruleId: "no-explicit-any" }),
                    baseFinding({ line: 12, ruleId: "no-unused-vars" }),
                ],
            }],
        })) as { runs: { tool: { driver: { rules: { id: string }[] } } }[] };

        const ruleIds = out.runs[0]!.tool.driver.rules.map((r) => r.id).sort();

        expect(ruleIds).toHaveLength(2);
        expect(ruleIds).toStrictEqual(["no-explicit-any", "no-unused-vars"]);
    });

    it("surfaces declaredVersion as tool.driver.version", () => {
        expect.assertions(1);

        const out = JSON.parse(emitSarif({
            runs: [{
                adapter: "eslint",
                findings: [],
                presence: { adapter: "eslint", declared: true, declaredVersion: "8.42.0", root: "/repo" },
            }],
        })) as { runs: { tool: { driver: { version?: string } } }[] };

        expect(out.runs[0]!.tool.driver.version).toBe("8.42.0");
    });
});
