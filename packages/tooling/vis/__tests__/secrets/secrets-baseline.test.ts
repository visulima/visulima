import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { diffBaseline, toRelativeFinding, writeBaseline } from "../../src/secrets/baseline";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe("secrets-baseline", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-secrets-baseline-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    const makeFinding = (overrides: Partial<ReturnType<typeof baseFinding>> = {}): ReturnType<typeof baseFinding> => {
        return {
            ...baseFinding(),
            ...overrides,
        };
    };

    const baseFinding = (): {
        description: string;
        endColumn: number;
        endLine: number;
        entropy: number;
        file: string;
        match: string;
        ruleId: string;
        secret: string;
        startColumn: number;
        startLine: number;
        tags: string[];
    } => {
        return {
            description: "",
            endColumn: 10,
            endLine: 1,
            entropy: 0,
            file: "",
            match: "",
            ruleId: "",
            secret: "",
            startColumn: 1,
            startLine: 1,
            tags: [],
        };
    };

    describe(toRelativeFinding, () => {
        it("converts absolute paths to root-relative", () => {
            expect.assertions(1);

            const finding = makeFinding({ file: join(tmpDir, "src/a.env"), ruleId: "aws" });
            const result = toRelativeFinding(finding, tmpDir);

            expect(result.file).toBe("src/a.env");
        });

        it("keeps already-relative paths unchanged", () => {
            expect.assertions(1);

            const finding = makeFinding({ file: "src/a.env", ruleId: "aws" });
            const result = toRelativeFinding(finding, tmpDir);

            expect(result.file).toBe("src/a.env");
        });
    });

    describe(writeBaseline, () => {
        it("creates a new baseline when none exists", () => {
            expect.assertions(3);

            const baselinePath = join(tmpDir, "baseline.json");
            const findings = [makeFinding({ file: join(tmpDir, "a.env"), ruleId: "aws", startLine: 1 })];

            const count = writeBaseline(findings, baselinePath, tmpDir);

            expect(count).toBe(1);
            expect(existsSync(baselinePath)).toBe(true);

            const parsed = JSON.parse(readFileSync(baselinePath, "utf8")) as { file: string }[];

            expect(parsed[0]!.file).toBe("a.env");
        });

        it("merges with an existing baseline by default", () => {
            expect.assertions(2);

            const baselinePath = join(tmpDir, "baseline.json");
            const existing = [makeFinding({ file: "a.env", ruleId: "old-rule", startLine: 10 })];

            writeFileSync(baselinePath, JSON.stringify(existing));

            const incoming = [makeFinding({ file: join(tmpDir, "b.env"), ruleId: "new-rule", startLine: 20 })];
            const count = writeBaseline(incoming, baselinePath, tmpDir);

            expect(count).toBe(2);

            const parsed = JSON.parse(readFileSync(baselinePath, "utf8")) as { ruleId: string }[];
            const ids = parsed.map((f) => f.ruleId);

            expect(ids).toStrictEqual(expect.arrayContaining(["old-rule", "new-rule"]));
        });

        it("replaces rather than merges when replace: true", () => {
            expect.assertions(2);

            const baselinePath = join(tmpDir, "baseline.json");

            writeFileSync(baselinePath, JSON.stringify([makeFinding({ file: "x", ruleId: "stale" })]));

            const count = writeBaseline([makeFinding({ file: "y", ruleId: "fresh" })], baselinePath, tmpDir, { replace: true });

            expect(count).toBe(1);

            const parsed = JSON.parse(readFileSync(baselinePath, "utf8")) as { ruleId: string }[];

            expect(parsed[0]!.ruleId).toBe("fresh");
        });
    });

    describe(diffBaseline, () => {
        it("splits findings into fresh / surviving / resolved", () => {
            expect.assertions(3);

            const baselinePath = join(tmpDir, "baseline.json");

            writeFileSync(
                baselinePath,
                JSON.stringify([makeFinding({ file: "a", ruleId: "known", startLine: 1 }), makeFinding({ file: "b", ruleId: "gone", startLine: 5 })]),
            );

            const current = [
                makeFinding({ file: "a", ruleId: "known", startLine: 1 }), // surviving
                makeFinding({ file: "c", ruleId: "new", startLine: 9 }), // fresh
            ];

            const diff = diffBaseline(current, baselinePath, tmpDir);

            expect(diff.fresh).toHaveLength(1);
            expect(diff.surviving).toHaveLength(1);
            expect(diff.resolved).toHaveLength(1);
        });
    });
});
