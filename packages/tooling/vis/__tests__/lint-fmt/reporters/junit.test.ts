import { describe, expect, it } from "vitest";

import type { Finding } from "../../../src/lint-fmt/config-types";
import { emitJUnit } from "../../../src/lint-fmt/reporters/junit";

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

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

describe(emitJUnit, () => {
    it("starts with an XML prolog and wraps in testsuites", () => {
        expect.assertions(2);

        const out = emitJUnit({ now: FIXED_NOW, runs: [] });

        expect(out).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        expect(out).toContain("<testsuites");
    });

    it("aggregates totals across runs", () => {
        expect.assertions(2);

        const out = emitJUnit({
            now: FIXED_NOW,
            runs: [
                {
                    adapter: "eslint",
                    durationMs: 1200,
                    findings: [baseFinding(), baseFinding({ line: 11, severity: "warning" })],
                },
                {
                    adapter: "oxlint",
                    durationMs: 80,
                    findings: [baseFinding({ adapter: "oxlint", line: 1 })],
                },
            ],
        });

        expect(out).toMatch(/<testsuites[^>]*tests="3"/);
        expect(out).toMatch(/<testsuites[^>]*failures="2"/);
    });

    it("emits one testsuite per adapter with per-suite counts", () => {
        expect.assertions(2);

        const out = emitJUnit({
            now: FIXED_NOW,
            runs: [
                {
                    adapter: "eslint",
                    durationMs: 100,
                    findings: [baseFinding({ severity: "error" }), baseFinding({ line: 11, severity: "warning" })],
                },
            ],
        });

        expect(out).toMatch(/<testsuite name="eslint" tests="2" failures="1" errors="0" skipped="1"/);
        expect(out).toContain("</testsuite>");
    });

    it("relativises file paths against workspaceRoot in testcase names", () => {
        expect.assertions(1);

        const out = emitJUnit({
            now: FIXED_NOW,
            runs: [{ adapter: "eslint", durationMs: 0, findings: [baseFinding({ file: "/repo/src/a.ts" })] }],
            workspaceRoot: "/repo",
        });

        expect(out).toContain(`name="src/a.ts:10:5"`);
    });

    it("escapes XML special characters in messages and rule ids", () => {
        expect.assertions(2);

        const out = emitJUnit({
            now: FIXED_NOW,
            runs: [
                {
                    adapter: "eslint",
                    durationMs: 0,
                    findings: [baseFinding({ message: "Bad <tag> & \"value\"", ruleId: "rule&one" })],
                },
            ],
        });

        expect(out).toContain("&amp;");
        expect(out).toContain("&lt;tag&gt;");
    });

    it("orders failures by file then line", () => {
        expect.assertions(1);

        const out = emitJUnit({
            now: FIXED_NOW,
            runs: [
                {
                    adapter: "eslint",
                    durationMs: 0,
                    findings: [
                        baseFinding({ file: "/repo/b.ts", line: 5 }),
                        baseFinding({ file: "/repo/a.ts", line: 12 }),
                        baseFinding({ file: "/repo/a.ts", line: 3 }),
                    ],
                },
            ],
            workspaceRoot: "/repo",
        });

        const positions = ["a.ts:3", "a.ts:12", "b.ts:5"].map((needle) => out.indexOf(needle));

        expect(positions[0]).toBeLessThan(positions[1]!);
    });
});
