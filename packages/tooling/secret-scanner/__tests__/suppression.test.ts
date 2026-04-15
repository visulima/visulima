import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexUrl = resolve(here, "..", "index.js");

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-"));
});

afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
});

const loadNative = async (): Promise<typeof import("../src/index") | undefined> => {
    try {
        await import(indexUrl);

        return await import("../src/index.js");
    } catch {
        return undefined;
    }
};

describe("suppression", () => {
    it("baseline JSON suppresses matching findings", async () => {
        expect.assertions(2);

        const nativeMod = await loadNative();

        if (!nativeMod) {
            return;
        }

        const leakFile = resolve(tmpDir, "leak.env");

        await writeFile(leakFile, 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await nativeMod.scan([tmpDir]);

        expect(findings.length).toBeGreaterThan(0);

        // Keep the baseline file outside the scan root so it doesn't get re-scanned
        // and produce new findings with different fingerprints.
        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, JSON.stringify(findings));

        try {
            const filtered = await nativeMod.scan([tmpDir], { baselinePath });

            expect(filtered).toHaveLength(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });
});
