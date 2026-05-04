import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadBaselineSet } from "../src/baseline";
import { fingerprint, legacyFingerprint } from "../src/fingerprint";
import type { Finding } from "../src/types";

const sampleFinding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        alternateMatches: [],
        confidence: "low",
        description: "",
        endColumn: 1,
        endLine: 1,
        entropy: 0,
        file: "src/app.ts",
        match: "token-value",
        ruleId: "sample-rule",
        secret: "token-value",
        startColumn: 1,
        startLine: 10,
        tags: [],
        ...overrides,
    };
};

let tmp: string;

beforeEach(async () => {
    tmp = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-test-"));
});

afterEach(async () => {
    await rm(tmp, { force: true, recursive: true });
});

describe(loadBaselineSet, () => {
    it("returns an empty set when the path is undefined", async () => {
        expect.assertions(1);

        await expect(loadBaselineSet(undefined)).resolves.toStrictEqual(new Set());
    });

    it("returns an empty set when the file does not exist", async () => {
        expect.assertions(1);

        await expect(loadBaselineSet(resolve(tmp, "missing.json"))).resolves.toStrictEqual(new Set());
    });

    it("logs and returns an empty set when the file isn't valid JSON", async () => {
        expect.assertions(2);

        const baselinePath = resolve(tmp, "bad.json");

        await writeFile(baselinePath, "{ not json");

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const set = await loadBaselineSet(baselinePath);

        expect(set.size).toBe(0);
        expect(consoleError.mock.calls.length).toBeGreaterThan(0);

        consoleError.mockRestore();
    });

    it("logs and returns an empty set when the JSON root isn't an array", async () => {
        expect.assertions(2);

        const baselinePath = resolve(tmp, "object.json");

        await writeFile(baselinePath, JSON.stringify({ findings: [] }));

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const set = await loadBaselineSet(baselinePath);

        expect(set.size).toBe(0);
        expect(consoleError.mock.calls.length).toBeGreaterThan(0);

        consoleError.mockRestore();
    });

    it("indexes each entry under both its content-hash and its legacy line-based fingerprint", async () => {
        expect.assertions(3);

        const finding = sampleFinding();
        const baselinePath = resolve(tmp, "baseline.json");

        await writeFile(baselinePath, JSON.stringify([finding]));

        const set = await loadBaselineSet(baselinePath);

        expect(set.size).toBe(2);
        expect(set.has(fingerprint(finding))).toBe(true);
        expect(set.has(legacyFingerprint(finding))).toBe(true);
    });

    it("tolerates entries missing the `secret` field (legacy baselines)", async () => {
        expect.assertions(2);

        // Build a finding-shaped object without the `secret` field to model
        // baselines written by older versions (or with redaction enabled).
        const rest: Omit<Finding, "secret"> = {
            alternateMatches: [],
            confidence: "low",
            description: "",
            endColumn: 1,
            endLine: 1,
            entropy: 0,
            file: "src/app.ts",
            match: "token-value",
            ruleId: "sample-rule",
            startColumn: 1,
            startLine: 10,
            tags: [],
        };
        const baselinePath = resolve(tmp, "legacy.json");

        await writeFile(baselinePath, JSON.stringify([rest]));

        const set = await loadBaselineSet(baselinePath);

        // Content-hash uses empty string when secret is absent; legacy is untouched.
        expect(set.has(legacyFingerprint(rest as Finding))).toBe(true);
        expect(set.has(fingerprint({ ...rest, secret: "" }))).toBe(true);
    });

    it("skips entries that don't match the Finding shape", async () => {
        expect.assertions(1);

        const baselinePath = resolve(tmp, "mixed.json");

        await writeFile(
            baselinePath,
            JSON.stringify([
                sampleFinding(),
                { not: "a finding" },
                // eslint-disable-next-line unicorn/no-null -- deliberately exercise the non-object branch.
                null,
                42,
            ]),
        );

        const set = await loadBaselineSet(baselinePath);

        // Only the valid entry makes it through → 2 fingerprints (content + legacy).
        expect(set.size).toBe(2);
    });
});
