import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBaselineSet, createBaseline, loadBaselineSet, resetBaselineCacheForTests, resolveBaselineSet, writeBaseline } from "../src/baseline";
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
    resetBaselineCacheForTests();
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

    it("caches by path + mtime and re-reads after the file changes", async () => {
        expect.assertions(3);

        const baselinePath = resolve(tmp, "cached.json");
        const first = sampleFinding({ ruleId: "rule-a" });

        await writeFile(baselinePath, JSON.stringify([first]));

        const set1 = await loadBaselineSet(baselinePath);

        expect(set1.has(fingerprint(first))).toBe(true);

        // Second read with the file unchanged returns the *same* Set instance
        // (cache hit — no re-parse).
        const set2 = await loadBaselineSet(baselinePath);

        expect(set2).toBe(set1);

        // Rewrite with different content + a bumped mtime → cache must invalidate.
        const second = sampleFinding({ ruleId: "rule-b" });

        await writeFile(baselinePath, JSON.stringify([second]));
        // Force a distinct mtime even on coarse-grained filesystems.
        await new Promise((_resolve) => {
            setTimeout(_resolve, 10);
        });
        await writeFile(baselinePath, JSON.stringify([second]));

        const set3 = await loadBaselineSet(baselinePath);

        expect(set3.has(fingerprint(second))).toBe(true);
    });
});

describe(buildBaselineSet, () => {
    it("indexes inline findings under both fingerprints", () => {
        expect.assertions(3);

        const finding = sampleFinding();
        const set = buildBaselineSet([finding]);

        expect(set.size).toBe(2);
        expect(set.has(fingerprint(finding))).toBe(true);
        expect(set.has(legacyFingerprint(finding))).toBe(true);
    });

    it("skips non-finding entries", () => {
        expect.assertions(1);

        // eslint-disable-next-line unicorn/no-null -- exercise the non-object guard.
        const set = buildBaselineSet([sampleFinding(), { junk: true } as never, null as never]);

        expect(set.size).toBe(2);
    });
});

describe(resolveBaselineSet, () => {
    it("returns an empty set for undefined", async () => {
        expect.assertions(1);

        await expect(resolveBaselineSet(undefined)).resolves.toStrictEqual(new Set());
    });

    it("builds a set from inline findings", async () => {
        expect.assertions(1);

        const finding = sampleFinding();
        const set = await resolveBaselineSet([finding]);

        expect(set.has(fingerprint(finding))).toBe(true);
    });

    it("returns a pre-computed fingerprint Set as-is", async () => {
        expect.assertions(1);

        const pre = new Set(["abc123"]);

        await expect(resolveBaselineSet(pre)).resolves.toBe(pre);
    });

    it("loads from a path", async () => {
        expect.assertions(1);

        const finding = sampleFinding();
        const baselinePath = resolve(tmp, "from-path.json");

        await writeFile(baselinePath, JSON.stringify([finding]));

        const set = await resolveBaselineSet(baselinePath);

        expect(set.has(fingerprint(finding))).toBe(true);
    });
});

describe(createBaseline, () => {
    it("serialises findings as a pretty-printed JSON array round-trippable by the loader", async () => {
        expect.assertions(2);

        const finding = sampleFinding();
        const json = createBaseline([finding]);

        expect(json.endsWith("\n")).toBe(true);

        const baselinePath = resolve(tmp, "written.json");

        await writeBaseline(baselinePath, [finding]);

        const onDisk = await readFile(baselinePath, "utf8");
        const set = await loadBaselineSet(baselinePath);

        expect(onDisk === json && set.has(fingerprint(finding))).toBe(true);
    });
});
