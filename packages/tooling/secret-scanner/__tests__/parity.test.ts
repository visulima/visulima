/**
 * Parity test vs. upstream gitleaks testdata.
 *
 * Skipped by default — this test downloads gitleaks' `testdata/` directory
 * (via `git sparse-checkout`) into `node_modules/.cache/secret-scanner/`
 * using `@visulima/find-cache-dir`, then runs our scanner and (if the
 * `gitleaks` CLI is on PATH) cross-checks rule-id coverage.
 *
 * Run with: `pnpm test:parity` (sets SECRET_SCANNER_PARITY=1).
 * Pin a ref with: `SECRET_SCANNER_PARITY_REF=v8.30.2 pnpm test:parity`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "node:process";
import { fileURLToPath } from "node:url";

import { findCacheDir } from "@visulima/find-cache-dir";
import { describe, expect, it } from "vitest";

import { scan } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const shouldRun = env.SECRET_SCANNER_PARITY === "1";
const ref = env.SECRET_SCANNER_PARITY_REF ?? "master";

interface GitleaksUpstream {
    File: string;
    RuleID: string;
    StartLine: number;
}

const fetchTestdata = async (): Promise<string> => {
    const cacheDir = await findCacheDir("secret-scanner", { create: true, cwd: packageRoot });

    if (!cacheDir) {
        throw new Error("no writable node_modules/.cache directory — run pnpm install first");
    }

    const tdRoot = resolve(cacheDir, `gitleaks-testdata-${ref}`);

    if (!existsSync(resolve(tdRoot, "testdata"))) {
        await mkdir(tdRoot, { recursive: true });
        execFileSync("git", ["init", "--quiet"], { cwd: tdRoot, stdio: "inherit" });
        execFileSync("git", ["remote", "add", "origin", "https://github.com/gitleaks/gitleaks.git"], {
            cwd: tdRoot,
            stdio: "inherit",
        });
        execFileSync("git", ["config", "core.sparseCheckout", "true"], { cwd: tdRoot, stdio: "inherit" });
        await writeFile(resolve(tdRoot, ".git/info/sparse-checkout"), "testdata/\nconfig/gitleaks.toml\n");
        execFileSync("git", ["pull", "--quiet", "--depth=1", "origin", ref], { cwd: tdRoot, stdio: "inherit" });
    }

    return resolve(tdRoot, "testdata");
};

describe.skipIf(!shouldRun)("gitleaks parity", () => {
    it("scans upstream gitleaks testdata and (optionally) matches gitleaks CLI coverage", async () => {
        expect.assertions(2);

        const scanRoot = await fetchTestdata();

        expect(existsSync(scanRoot)).toBe(true);

        const ours = await scan([scanRoot], { walk: { gitignore: false, includeHidden: true } });
        const ourRuleIds = new Set(ours.map((f) => f.ruleId));

        // eslint-disable-next-line no-console
        console.log(`  our findings: ${ours.length} across ${ourRuleIds.size} rules`);

        const gitleaksVersion = spawnSync("gitleaks", ["version"], { encoding: "utf8" });

        if (gitleaksVersion.status !== 0) {
            // eslint-disable-next-line no-console
            console.log("  (gitleaks CLI not on PATH — install from https://github.com/gitleaks/gitleaks to enable cross-check)");

            return;
        }

        const cacheDir = await findCacheDir("secret-scanner", { create: true, cwd: packageRoot });
        const reportPath = resolve(cacheDir!, "gitleaks-report.json");

        spawnSync("gitleaks", ["detect", "--source", scanRoot, "--no-git", "--report-format", "json", "--report-path", reportPath], { stdio: "pipe" });

        if (!existsSync(reportPath)) {
            // eslint-disable-next-line no-console
            console.log("  (gitleaks produced no report — testdata may not match its current layout)");

            return;
        }

        const gitleaks = JSON.parse(await readFile(reportPath, "utf8")) as GitleaksUpstream[];
        const theirRuleIds = new Set(gitleaks.map((f) => f.RuleID));
        const overlap = [...ourRuleIds].filter((id) => theirRuleIds.has(id));
        const parity = theirRuleIds.size === 0 ? 1 : overlap.length / theirRuleIds.size;

        // eslint-disable-next-line no-console
        console.log(`  gitleaks rules: ${theirRuleIds.size}, overlap: ${overlap.length}, parity: ${(parity * 100).toFixed(1)}%`);

        // Soft assertion: warn loudly below 0.75, hard-fail below 0.5. Some rules need
        // git-history walking (v1 skips) or specific filesystem layouts we may not replicate.
        if (theirRuleIds.size > 0) {
            expect(parity).toBeGreaterThan(0.5);
        }
    }, 120_000);
});
