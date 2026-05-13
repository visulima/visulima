import { writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readPmNativeMinimumReleaseAge } from "../../../src/commands/update/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe(readPmNativeMinimumReleaseAge, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-min-release-age-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    describe("pnpm", () => {
        it("reads minimumReleaseAge + minimumReleaseAgeExclude from pnpm-workspace.yaml", () => {
            expect.assertions(2);

            writeFileSync(
                join(workspaceRoot, "pnpm-workspace.yaml"),
                "minimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - typescript\n  - '@types/node'\n",
            );

            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "pnpm");

            expect(result.minutes).toBe(1440);
            expect(result.excludes).toStrictEqual(["typescript", "@types/node"]);
        });

        it("returns empty object when pnpm-workspace.yaml is absent", () => {
            expect.assertions(1);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "pnpm")).toStrictEqual({});
        });
    });

    describe("bun", () => {
        it("reads minimumReleaseAge from bunfig.toml [install] — NOT package.json", () => {
            // Regression guard: prior code looked for `pkg.minimumReleaseAge`
            // in package.json. Bun's installer config lives under
            // `bunfig.toml [install]` (https://bun.sh/docs/runtime/bunfig).
            expect.assertions(2);

            // A package.json with the field present must NOT be picked up —
            // bun never reads minimumReleaseAge from there.
            writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ minimumReleaseAge: 9999, name: "root" }, undefined, 2));
            writeFileSync(
                join(workspaceRoot, "bunfig.toml"),
                "[install]\nminimumReleaseAge = 259200\nminimumReleaseAgeExcludes = [\"@types/bun\", \"typescript\"]\n",
            );

            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "bun");

            // Bun's value is in SECONDS (259200s = 72h = 3 days); vis canonicalises
            // on minutes, so 259200 / 60 = 4320.
            expect(result.minutes).toBe(4320);
            // Bun spells the excludes field plural (`Excludes`); we normalise
            // to the vis-internal singular (`excludes`) for symmetry with pnpm.
            expect(result.excludes).toStrictEqual(["@types/bun", "typescript"]);
        });

        it("returns empty object when bunfig.toml is absent", () => {
            expect.assertions(1);

            // package.json present but bunfig.toml is not → nothing returned,
            // even if package.json happens to have a `minimumReleaseAge` key.
            writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ minimumReleaseAge: 9999, name: "root" }, undefined, 2));

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "bun")).toStrictEqual({});
        });

        it("tolerates a bunfig.toml that omits [install]", () => {
            expect.assertions(2);

            writeFileSync(join(workspaceRoot, "bunfig.toml"), "[run]\nshell = \"system\"\n");

            // Both fields absent — shape may be `{}` or `{ minutes: undefined, excludes: undefined }`,
            // both equivalent at the call site (`a ?? b` flattens them).
            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "bun");

            expect(result.minutes).toBeUndefined();
            expect(result.excludes).toBeUndefined();
        });
    });

    describe("npm", () => {
        it("reads a bare integer as days (npm's canonical unit)", () => {
            expect.assertions(1);

            // npm CLI's option type is `null or Number` measured in days, so
            // `min-release-age=2` ≡ 2 days = 2880 minutes.
            writeFileSync(join(workspaceRoot, ".npmrc"), "registry=https://registry.npmjs.org/\nmin-release-age=2\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm").minutes).toBe(2880);
        });

        it("still parses `Nd` duration strings (legacy vis writes) for back-compat", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, ".npmrc"), "min-release-age=2d\n");

            // 2 days = 2880 minutes.
            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm").minutes).toBe(2880);
        });

        it("handles legacy hour and minute units for back-compat", () => {
            expect.assertions(2);

            writeFileSync(join(workspaceRoot, ".npmrc"), "min-release-age=48h\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm").minutes).toBe(2880);

            writeFileSync(join(workspaceRoot, ".npmrc"), "min-release-age=90m\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm").minutes).toBe(90);
        });

        it("returns undefined minutes when .npmrc lacks the field", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, ".npmrc"), "registry=https://registry.npmjs.org/\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm")).toStrictEqual({ minutes: undefined });
        });

        it("returns empty object when .npmrc is absent", () => {
            expect.assertions(1);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm")).toStrictEqual({});
        });
    });

    describe("yarn", () => {
        it("reads npmMinimalAgeGate string from .yarnrc.yml and converts to minutes", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, ".yarnrc.yml"), "nodeLinker: pnp\nnpmMinimalAgeGate: \"48h\"\n");

            // 48 hours = 2880 minutes.
            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "yarn").minutes).toBe(2880);
        });

        it("tolerates a bare numeric value (interpreted as minutes for symmetry with pnpm)", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, ".yarnrc.yml"), "npmMinimalAgeGate: 1440\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "yarn").minutes).toBe(1440);
        });

        it("returns empty object when .yarnrc.yml is absent (yarn classic case)", () => {
            expect.assertions(1);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "yarn")).toStrictEqual({});
        });
    });

    describe("malformed config", () => {
        it("swallows a corrupt bunfig.toml and returns empty object", () => {
            expect.assertions(1);

            // Invalid TOML — `readTomlSync` would throw; the helper must catch.
            writeFileSync(join(workspaceRoot, "bunfig.toml"), "[install\nminimumReleaseAge = ");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "bun")).toStrictEqual({});
        });

        it("returns undefined minutes for unparseable npm time strings", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, ".npmrc"), "min-release-age=not-a-duration\n");

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm").minutes).toBeUndefined();
        });
    });
});
