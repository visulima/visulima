import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { syncMinimumReleaseAgeToNativeConfig } from "../../src/security/security";

describe(syncMinimumReleaseAgeToNativeConfig, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-mra-sync-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    describe("no-op cases", () => {
        it("returns a skip-notice when minutes is undefined", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, undefined);

            expect(actions[0]).toContain("not set in vis.config");
        });
    });

    describe("pnpm", () => {
        it("writes minimumReleaseAge in minutes to pnpm-workspace.yaml", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

            syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(content).toContain("minimumReleaseAge: 2880");
            // Pre-existing keys must survive.
            expect(content).toContain("packages:");
        });

        it("replaces an existing minimumReleaseAge in-place (idempotent)", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "minimumReleaseAge: 1440\npackages:\n  - 'packages/*'\n");

            syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(content).toContain("minimumReleaseAge: 2880");
            expect(content).not.toContain("minimumReleaseAge: 1440");
        });

        it("writes minimumReleaseAgeExclude as a YAML list", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

            syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 1440, ["typescript", "@types/node"]);

            const content = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(content).toContain("minimumReleaseAgeExclude:");
            expect(content).toContain("- typescript");
            // Scoped names are YAML-quoted.
            expect(content).toContain("'@types/node'");
        });

        it("reports an error when pnpm-workspace.yaml is missing", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 1440);

            expect(actions[0]).toContain("pnpm-workspace.yaml not found");
        });
    });

    describe("bun", () => {
        it("converts minutes to seconds when writing bunfig.toml [install]", () => {
            expect.assertions(2);

            // 48 hours = 2880 minutes = 172800 seconds.
            syncMinimumReleaseAgeToNativeConfig("bun", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, "bunfig.toml"), "utf8");

            expect(content).toContain("[install]");
            expect(content).toContain("minimumReleaseAge = 172800");
        });

        it("preserves an existing [install] section and unrelated keys", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "bunfig.toml"), "[install]\nregistry = \"https://registry.npmjs.org/\"\nminimumReleaseAge = 60\n");

            syncMinimumReleaseAgeToNativeConfig("bun", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, "bunfig.toml"), "utf8");

            expect(content).toContain("registry = \"https://registry.npmjs.org/\"");
            expect(content).toContain("minimumReleaseAge = 172800");
            // Old value must be replaced, not duplicated.
            expect(content).not.toMatch(/minimumReleaseAge = 60\b/);
        });

        it("writes minimumReleaseAgeExcludes (plural, bun's spelling) as a TOML array", () => {
            expect.assertions(1);

            syncMinimumReleaseAgeToNativeConfig("bun", tmpDir, 1440, ["typescript", "@types/bun"]);

            const content = readFileSync(join(tmpDir, "bunfig.toml"), "utf8");

            expect(content).toContain("minimumReleaseAgeExcludes = [\"typescript\", \"@types/bun\"]");
        });
    });

    describe("npm", () => {
        it("writes min-release-age as an integer (days) to .npmrc — npm's unit", () => {
            expect.assertions(2);

            // 2880 minutes = 48 hours = 2 days. npm's `min-release-age` is
            // typed as `null or Number` measured in days, so we write `2`.
            const actions = syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("min-release-age=2");
            expect(actions[0]).toContain("min-release-age=2");
        });

        it("replaces an existing min-release-age line in-place", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".npmrc"), "registry=https://registry.npmjs.org/\nmin-release-age=1d\n");

            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("min-release-age=2");
            expect(content).not.toContain("min-release-age=1d");
        });

        it("rounds sub-day minute counts up to at least one day", () => {
            expect.assertions(1);

            // 60 minutes can't be represented in npm's day-only field — the
            // safe choice is to round up (stricter gate), never down.
            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 60);

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("min-release-age=1");
        });

        it("notes that excludes are skipped (npm has no native equivalent)", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 1440, ["typescript"]);

            expect(actions.some((a) => a.includes("no native per-package exclude list"))).toBe(true);
        });
    });

    describe("yarn (berry)", () => {
        it("writes npmMinimalAgeGate as a bare integer (minutes) — dodges yarnpkg/berry#6991", () => {
            expect.assertions(2);

            // yarn's docs advertise duration strings, but `"2d"` is silently
            // treated as 2 *minutes* due to yarnpkg/berry#6991. Vis writes a
            // bare integer minute count instead.
            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: pnp\n");

            syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("npmMinimalAgeGate: 2880");
            expect(content).not.toContain("npmMinimalAgeGate: \"");
        });

        it("replaces an existing npmMinimalAgeGate (including legacy duration-string form)", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "npmMinimalAgeGate: \"24h\"\nnodeLinker: pnp\n");

            syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("npmMinimalAgeGate: 2880");
            expect(content).not.toContain("npmMinimalAgeGate: \"24h\"");
        });

        it("writes npmPreapprovedPackages (yarn's native exclude list) when excludes are present", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: pnp\n");

            syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 1440, ["typescript", "@types/node"]);

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("npmPreapprovedPackages:");
            expect(content).toContain("- typescript");
            // Scoped names are YAML-quoted.
            expect(content).toContain("'@types/node'");
        });

        it("skips with note when .yarnrc.yml is absent (yarn classic case)", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 1440);

            expect(actions[0]).toContain("yarn classic");
        });
    });

    describe("fractional-minute canonicalisation", () => {
        it("rounds sub-minute fractions to zero across all PMs (canonical disable)", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - '.'\n");
            writeFileSync(join(tmpDir, "bunfig.toml"), "");
            writeFileSync(join(tmpDir, ".npmrc"), "");

            syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 0.4);
            syncMinimumReleaseAgeToNativeConfig("bun", tmpDir, 0.4);
            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 0.4);

            // 0.4 minutes rounds to 0 (Math.round(0.4) === 0). Every PM gets
            // its canonical disable value: pnpm `0` (minutes), bun `0` (seconds),
            // npm `0` (days).
            expect(readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8")).toContain("minimumReleaseAge: 0");
            expect(readFileSync(join(tmpDir, "bunfig.toml"), "utf8")).toContain("minimumReleaseAge = 0");
            expect(readFileSync(join(tmpDir, ".npmrc"), "utf8")).toContain("min-release-age=0");
        });

        it("rounds 1.5 minutes up to 1 day for npm (npm can only express days)", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "");

            // 1.5 → 2 minutes (Math.round) → ceil(2/1440) = 1 day. npm gate
            // ends up stricter than vis-config, never weaker.
            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 1.5);

            expect(readFileSync(join(tmpDir, ".npmrc"), "utf8")).toContain("min-release-age=1");
        });
    });
});
