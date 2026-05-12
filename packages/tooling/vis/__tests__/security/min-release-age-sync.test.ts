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

            writeFileSync(
                join(tmpDir, "bunfig.toml"),
                "[install]\nregistry = \"https://registry.npmjs.org/\"\nminimumReleaseAge = 60\n",
            );

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
        it("writes min-release-age as a duration string to .npmrc", () => {
            expect.assertions(2);

            // 2880 minutes = 48 hours = 2 days → renders as "2d".
            const actions = syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("min-release-age=2d");
            expect(actions[0]).toContain("min-release-age=2d");
        });

        it("replaces an existing min-release-age line in-place", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".npmrc"), "registry=https://registry.npmjs.org/\nmin-release-age=1d\n");

            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("min-release-age=2d");
            expect(content).not.toMatch(/min-release-age=1d\b/);
        });

        it("notes that excludes are skipped (npm has no native equivalent)", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 1440, ["typescript"]);

            expect(actions.some((a) => a.includes("no native per-package exclude list"))).toBe(true);
        });
    });

    describe("yarn (berry)", () => {
        it("writes npmMinimalAgeGate as a quoted duration string to .yarnrc.yml", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: pnp\n");

            syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("npmMinimalAgeGate: \"2d\"");
        });

        it("replaces an existing npmMinimalAgeGate", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "npmMinimalAgeGate: \"24h\"\nnodeLinker: pnp\n");

            syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 2880);

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("npmMinimalAgeGate: \"2d\"");
            expect(content).not.toContain("npmMinimalAgeGate: \"24h\"");
        });

        it("skips with note when .yarnrc.yml is absent (yarn classic case)", () => {
            expect.assertions(1);

            const actions = syncMinimumReleaseAgeToNativeConfig("yarn", tmpDir, 1440);

            expect(actions[0]).toContain("yarn classic");
        });
    });

    describe("fractional-minute canonicalisation", () => {
        it("rounds sub-minute fractions up to whole minutes before writing (no PM-specific drift)", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - '.'\n");
            writeFileSync(join(tmpDir, "bunfig.toml"), "");
            writeFileSync(join(tmpDir, ".npmrc"), "");

            syncMinimumReleaseAgeToNativeConfig("pnpm", tmpDir, 0.4);
            syncMinimumReleaseAgeToNativeConfig("bun", tmpDir, 0.4);
            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 0.4);

            // 0.4 minutes is rounded to 0 (Math.round(0.4) === 0). pnpm writes
            // "minimumReleaseAge: 0", bun writes "0" seconds, npm writes "0m".
            // All three are the same canonical zero, so a follow-up drift check
            // sees a consistent value across PMs.
            expect(readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8")).toContain("minimumReleaseAge: 0");
            expect(readFileSync(join(tmpDir, "bunfig.toml"), "utf8")).toContain("minimumReleaseAge = 0");
            expect(readFileSync(join(tmpDir, ".npmrc"), "utf8")).toContain("min-release-age=0m");
        });

        it("rounds 1.5 minutes up to 2 minutes (largest whole-unit string is `2m`)", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "");

            syncMinimumReleaseAgeToNativeConfig("npm", tmpDir, 1.5);

            expect(readFileSync(join(tmpDir, ".npmrc"), "utf8")).toContain("min-release-age=2m");
        });
    });
});
