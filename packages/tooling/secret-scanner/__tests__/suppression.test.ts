import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { scan, scanString } from "../src/index";

// Warm the Rust regex JIT (full bundled ruleset) once so tests don't timeout.
beforeAll(async () => {
    await scanString("warmup", "warmup.txt");
}, 120_000);

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-"));
});

afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
});

describe("suppression", () => {
    it("baseline JSON suppresses matching findings", async () => {
        expect.assertions(2);

        const leakFile = resolve(tmpDir, "leak.env");

        await writeFile(leakFile, 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await scan([tmpDir]);

        expect(findings.length).toBeGreaterThan(0);

        // Keep the baseline file outside the scan root so it doesn't get re-scanned
        // and produce new findings with different fingerprints.
        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, JSON.stringify(findings));

        try {
            const filtered = await scan([tmpDir], { baseline: baselinePath });

            expect(filtered).toHaveLength(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });

    it("content-hash fingerprint survives line shifts in the source file", async () => {
        expect.assertions(3);

        const leakFile = resolve(tmpDir, "leak.env");
        const secretLine = 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n';

        await writeFile(leakFile, secretLine);

        const originalFindings = await scan([tmpDir]);

        expect(originalFindings.length).toBeGreaterThan(0);
        expect(originalFindings[0]?.startLine).toBe(1);

        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, JSON.stringify(originalFindings));

        // Prepend four blank lines so the same secret now lives at line 5 — the
        // content-hash fingerprint hashes `(secret, ruleId, file)` and must
        // still match the baseline entry despite the line shift.
        await writeFile(leakFile, `\n\n\n\n${secretLine}`);

        try {
            const filtered = await scan([tmpDir], { baseline: baselinePath });

            expect(filtered).toHaveLength(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });

    it("accepts legacy line-based baselines for backwards compatibility", async () => {
        expect.assertions(1);

        const leakFile = resolve(tmpDir, "leak.env");

        await writeFile(leakFile, 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const fresh = await scan([tmpDir]);

        // Simulate a pre-content-hash baseline: keep the raw Finding shape but
        // strip the `secret` field to model older writers that sometimes left
        // the field off (redacted CI output). Suppression must still match via
        // the legacy line-based fingerprint.
        const legacyEntries = fresh.map(({ secret: _secret, ...rest }) => rest);
        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, JSON.stringify(legacyEntries));

        try {
            const filtered = await scan([tmpDir], { baseline: baselinePath });

            expect(filtered).toHaveLength(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });
});
