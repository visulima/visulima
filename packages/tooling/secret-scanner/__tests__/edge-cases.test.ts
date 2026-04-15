import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexUrl = resolve(here, "..", "index.js");

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-edge-"));
});

afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
});

const loadApi = async (): Promise<typeof import("../src/index") | undefined> => {
    try {
        await import(indexUrl);

        return await import("../src/index.js");
    } catch {
        return undefined;
    }
};

describe("edge cases", () => {
    it("skips binary files (null byte in first 8 KiB)", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const bin = Buffer.concat([Buffer.from([0x00, 0x01, 0x02]), Buffer.from(`token = "${secret}"`)]);

        await writeFile(resolve(tmpDir, "blob.bin"), bin);

        const findings = await api.scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("detects leaks in files >1 MiB (mmap path)", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const padding = "lorem ipsum\n".repeat(100_000); // ~1.2 MiB
        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "big.txt"), `${padding}\ntoken = "${secret}"\n`);

        const findings = await api.scan([tmpDir]);

        expect(findings.some((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("handles non-UTF-8 bytes via lossy decode", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const bytes = Buffer.concat([Buffer.from('token = "'), Buffer.from([0xff, 0xfe]), Buffer.from(`${secret}"\n`)]);

        await writeFile(resolve(tmpDir, "weird.txt"), bytes);

        const findings = await api.scan([tmpDir]);

        expect(findings.some((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("returns deterministic order across runs", async () => {
        expect.assertions(2);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "a.env"), 'a = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');
        await writeFile(resolve(tmpDir, "b.env"), 'b = "ghp_zY9xW8vU7tS6rQ5pO4nM3lK2jI1hG0fE9dC8bA7a"\n');

        const runs = await Promise.all([api.scan([tmpDir]), api.scan([tmpDir]), api.scan([tmpDir])]);

        const keys = runs.map((r) => r.map((f) => `${f.file}:${f.startLine}`).join("|"));

        expect(keys[0]).toBe(keys[1]);
        expect(keys[1]).toBe(keys[2]);
    });

    it("inspectRuleset reports rules that failed to compile", async () => {
        expect.assertions(2);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const badConfig = {
            rules: [
                { id: "broken-rule", keywords: ["tok"], regex: "(" },
                { id: "ok-rule", keywords: ["ok"], regex: "ok[0-9]+" },
            ],
            title: "bad",
        };

        const skipped = await api.inspectRuleset({ config: { extendBundled: false, inline: badConfig } });

        expect(skipped.length).toBeGreaterThan(0);
        expect(skipped[0]!.ruleId).toBe("broken-rule");
    });

    it("respects gitleaks:allow inline comment", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "allowed.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b" // gitleaks:allow\n');

        const findings = await api.scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("respects secret-scanner:allow inline comment", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "allowed.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b" # secret-scanner:allow\n');

        const findings = await api.scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("scanFiles scans a fixed file list and skips the walker", async () => {
        expect.assertions(2);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "leak.env"), `token = "${secret}"\n`);
        await writeFile(resolve(tmpDir, "clean.env"), "no secret here\n");

        const findings = await api.scanFiles([resolve(tmpDir, "leak.env")]);

        expect(findings).toHaveLength(1);
        expect(findings[0]!.file).toContain("leak.env");
    });

    it("block allow-comments suppress findings between gitleaks:allow-start and gitleaks:allow-end", async () => {
        expect.assertions(2);

        const api = await loadApi();

        if (!api) {
            return;
        }

        // Both high-entropy to satisfy the rule's entropy threshold.
        const secret1 = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const secret2 = "ghp_zY9xW8vU7tS6rQ5pO4nM3lK2jI1hG0fE9dC8bA7c";

        await writeFile(
            resolve(tmpDir, "fixture.env"),
            `
# gitleaks:allow-start
suppressed = "${secret1}"
# gitleaks:allow-end
leaked = "${secret2}"
`,
        );

        const findings = await api.scan([tmpDir]);

        // Only the second secret (outside the allow region) should be reported.
        expect(findings).toHaveLength(1);
        expect(findings[0]!.match).toContain("ghp_zY9xW8");
    });

    it("listRules returns rule metadata", async () => {
        expect.assertions(3);

        const api = await loadApi();

        if (!api) {
            return;
        }

        const rules = await api.listRules();

        expect(rules.length).toBeGreaterThan(100);

        const githubPat = rules.find((r) => r.id === "github-pat");

        expect(githubPat).toBeDefined();
        expect(githubPat!.keywords).toContain("ghp_");
    });

    it("onlyRules limits scan output to listed rule ids", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(
            resolve(tmpDir, "multi.env"),
            ['gh = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"', 'stripe = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"'].join("\n"),
        );

        const findings = await api.scan([tmpDir], { rules: { include: ["github-pat"] } });

        expect(findings.every((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("disableRules drops listed rule ids from the results", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await api.scan([tmpDir], { rules: { exclude: ["github-pat"] } });

        expect(findings.every((f) => f.ruleId !== "github-pat")).toBe(true);
    });

    it("excludePatterns excludes files matching a gitignore pattern", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await api.scan([tmpDir], { walk: { excludePatterns: ["*.env"] } });

        expect(findings).toHaveLength(0);
    });

    it("excludeFromFiles honors a .secretsignore file with gitignore syntax", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');
        await writeFile(resolve(tmpDir, ".secretsignore"), "*.env\n");

        const findings = await api.scan([tmpDir], { walk: { excludeFromFiles: [resolve(tmpDir, ".secretsignore")] } });

        expect(findings).toHaveLength(0);
    });

    it("scanFiles respects excludeFromFiles and excludePatterns via JS matcher", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const originalCwd = process.cwd();

        try {
            process.chdir(tmpDir);
            const findings = await api.scanFiles([resolve(tmpDir, "leak.env")], { walk: { excludePatterns: ["*.env"] } });

            expect(findings).toHaveLength(0);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("ignores malformed baseline files with a warning", async () => {
        expect.assertions(1);

        const api = await loadApi();

        if (!api) {
            return;
        }

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, "{not-an-array");

        try {
            const findings = await api.scan([tmpDir], { baseline: baselinePath });

            // Malformed baseline is ignored, scan should still return the leak.
            expect(findings.length).toBeGreaterThan(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });
});
