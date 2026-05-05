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
                '[install]\nminimumReleaseAge = 259200\nminimumReleaseAgeExcludes = ["@types/bun", "typescript"]\n',
            );

            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "bun");

            // 259200 from bunfig.toml — definitively not 9999 from package.json.
            expect(result.minutes).toBe(259_200);
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

            writeFileSync(join(workspaceRoot, "bunfig.toml"), '[run]\nshell = "system"\n');

            // Both fields absent — shape may be `{}` or `{ minutes: undefined, excludes: undefined }`,
            // both equivalent at the call site (`a ?? b` flattens them).
            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "bun");

            expect(result.minutes).toBeUndefined();
            expect(result.excludes).toBeUndefined();
        });
    });

    describe("unsupported package managers", () => {
        it("returns empty object for npm/yarn (neither has a native minimumReleaseAge field)", () => {
            expect.assertions(2);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "npm")).toStrictEqual({});
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
    });
});
