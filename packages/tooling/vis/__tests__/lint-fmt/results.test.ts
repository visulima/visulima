import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/lint-fmt/config-types";
import { aggregate, compareSeverity, exitCodeFor, groupFindingsByFile } from "../../src/lint-fmt/results";

const finding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        adapter: "eslint",
        file: "/repo/src/a.ts",
        fixable: false,
        message: "stub",
        severity: "warning",
        ...overrides,
    };
};

describe(aggregate, () => {
    it("returns empty result when there are no findings or runs", () => {
        expect.assertions(4);

        const result = aggregate([]);

        expect(result.findings).toHaveLength(0);
        expect(result.runs).toHaveLength(0);
        expect(result.maxSeverity).toBeUndefined();
        expect(result.hadProcessFailure).toBe(false);
    });

    it("computes the highest observed severity", () => {
        expect.assertions(1);

        const result = aggregate([
            {
                adapter: "eslint",
                durationMs: 1,
                exitCode: 0,
                findingCount: 2,
                findings: [finding({ severity: "info" }), finding({ severity: "error" })],
            },
        ]);

        expect(result.maxSeverity).toBe("error");
    });

    it("does not flag a process failure when exit is non-zero but findings explain it", () => {
        expect.assertions(2);

        const result = aggregate([
            {
                adapter: "eslint",
                durationMs: 1,
                exitCode: 1,
                findingCount: 1,
                findings: [finding({ severity: "error" })],
            },
        ]);

        expect(result.hadProcessFailure).toBe(false);
        expect(result.maxSeverity).toBe("error");
    });

    it("flags a process failure on non-zero exit with no findings", () => {
        expect.assertions(1);

        const result = aggregate([
            {
                adapter: "eslint",
                durationMs: 1,
                exitCode: 2,
                findingCount: 0,
                findings: [],
            },
        ]);

        expect(result.hadProcessFailure).toBe(true);
    });
});

describe(groupFindingsByFile, () => {
    it("buckets findings per file and preserves insertion order", () => {
        expect.assertions(3);

        const grouped = groupFindingsByFile([
            finding({ file: "/repo/a.ts" }),
            finding({ file: "/repo/b.ts" }),
            finding({ file: "/repo/a.ts", message: "second" }),
        ]);

        expect([...grouped.keys()]).toStrictEqual(["/repo/a.ts", "/repo/b.ts"]);
        expect(grouped.get("/repo/a.ts")).toHaveLength(2);
        expect(grouped.get("/repo/b.ts")).toHaveLength(1);
    });
});

describe(exitCodeFor, () => {
    it("returns 0 when there are no errors and no process failures", () => {
        expect.assertions(1);

        const result = aggregate([{ adapter: "prettier", durationMs: 1, exitCode: 0, findingCount: 1, findings: [finding({ severity: "info" })] }]);

        expect(exitCodeFor(result)).toBe(0);
    });

    it("returns 1 when at least one finding is an error", () => {
        expect.assertions(1);

        const result = aggregate([{ adapter: "eslint", durationMs: 1, exitCode: 1, findingCount: 1, findings: [finding({ severity: "error" })] }]);

        expect(exitCodeFor(result)).toBe(1);
    });

    it("returns 1 when there was a process failure", () => {
        expect.assertions(1);

        const result = aggregate([{ adapter: "eslint", durationMs: 1, exitCode: 2, findingCount: 0, findings: [] }]);

        expect(exitCodeFor(result)).toBe(1);
    });
});

describe(compareSeverity, () => {
    it("orders info < warning < error", () => {
        expect.assertions(3);

        expect(compareSeverity("info", "warning")).toBeLessThan(0);
        expect(compareSeverity("warning", "error")).toBeLessThan(0);
        expect(compareSeverity("error", "error")).toBe(0);
    });
});
