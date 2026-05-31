import { describe, expect, it } from "vitest";

import type { Finding } from "../../../src/lint-fmt/config-types";
import { emitGitHub } from "../../../src/lint-fmt/reporters/github";

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

describe(emitGitHub, () => {
    it("renders error findings with workflow ::error commands", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding()] }],
            workspaceRoot: "/repo",
        });

        expect(out).toBe("::error file=src/a.ts,line=10,col=5,title=eslint(no-explicit-any)::Unexpected `any`\n");
    });

    it("renders warning findings as ::warning", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ severity: "warning" })] }],
            workspaceRoot: "/repo",
        });

        expect(out.startsWith("::warning ")).toBe(true);
    });

    it("renders info findings as ::notice", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ severity: "info" })] }],
            workspaceRoot: "/repo",
        });

        expect(out.startsWith("::notice ")).toBe(true);
    });

    it("includes endLine and endColumn when provided", () => {
        expect.assertions(2);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ endColumn: 12, endLine: 11 })] }],
            workspaceRoot: "/repo",
        });

        expect(out).toContain("endLine=11");
        expect(out).toContain("endColumn=12");
    });

    it("emits the file path verbatim when workspaceRoot is missing", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding()] }],
        });

        expect(out).toContain("file=/repo/src/a.ts");
    });

    it("emits the adapter id alone when ruleId is missing (no rule suffix)", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ ruleId: undefined })] }],
            workspaceRoot: "/repo",
        });

        expect(out).toContain(",title=eslint::");
    });

    it("percent-encodes newlines and control characters in the message", () => {
        expect.assertions(2);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ message: "line one\nline two" })] }],
            workspaceRoot: "/repo",
        });

        expect(out).toContain("line one%0Aline two");
        expect(out).not.toContain("line one\nline two");
    });

    it("percent-encodes commas and colons in property values", () => {
        expect.assertions(2);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ file: "/repo/src/has,comma:colon.ts" })] }],
            workspaceRoot: "/repo",
        });

        expect(out).toContain("file=src/has%2Ccomma%3Acolon.ts");
        expect(out).not.toContain("has,comma:colon");
    });

    it("sorts findings by file, line, then column across runs", () => {
        expect.assertions(1);

        const out = emitGitHub({
            runs: [
                {
                    findings: [
                        baseFinding({ file: "/repo/b.ts", line: 5 }),
                        baseFinding({ file: "/repo/a.ts", line: 20 }),
                        baseFinding({ file: "/repo/a.ts", line: 3 }),
                    ],
                },
            ],
            workspaceRoot: "/repo",
        });

        const lines = out.trim().split("\n");

        const extract = (line: string): string[] | undefined => {
            const pattern = /file=([^,]+),line=(\d+)/u;

            return pattern.exec(line)?.slice(1, 3);
        };

        expect(lines.map((line) => extract(line))).toStrictEqual([
            ["a.ts", "3"],
            ["a.ts", "20"],
            ["b.ts", "5"],
        ]);
    });

    it("omits line and column for file-level findings", () => {
        expect.assertions(2);

        const out = emitGitHub({
            runs: [{ findings: [baseFinding({ column: undefined, line: undefined })] }],
            workspaceRoot: "/repo",
        });

        expect(out).not.toContain("line=");
        expect(out).not.toContain("col=");
    });

    it("returns an empty string for empty runs", () => {
        expect.assertions(1);

        expect(emitGitHub({ runs: [] })).toBe("");
    });
});
