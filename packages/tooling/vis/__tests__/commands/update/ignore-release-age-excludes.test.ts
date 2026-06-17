import { readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addReleaseAgeExcludesForInstall, readPmNativeMinimumReleaseAge } from "../../../src/commands/update/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe(addReleaseAgeExcludesForInstall, () => {
    let workspaceRoot: string;

    const write = (file: string, content: string): void => {
        writeFileSync(join(workspaceRoot, file), content);
    };

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-ignore-release-age-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    describe("pnpm", () => {
        it("adds the selected packages to minimumReleaseAgeExclude when a gate is active", () => {
            expect.assertions(4);

            write("pnpm-workspace.yaml", "minimumReleaseAge: 1440\n");

            const { added, unsupported } = addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["react", "react-dom"]);

            expect(added).toStrictEqual(["react", "react-dom"]);
            expect(unsupported).toBe(false);

            const result = readPmNativeMinimumReleaseAge(workspaceRoot, "pnpm");

            // The gate value is preserved; only the exclude list grows.
            expect(result.minutes).toBe(1440);
            expect(result.excludes).toStrictEqual(["react", "react-dom"]);
        });

        it("merges into an existing exclude list without duplicating", () => {
            expect.assertions(2);

            write("pnpm-workspace.yaml", "minimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - typescript\n");

            const { added } = addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["typescript", "react"]);

            expect(added).toStrictEqual(["react"]);
            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "pnpm").excludes).toStrictEqual(["typescript", "react"]);
        });

        it("dedupes repeated names in the input", () => {
            expect.assertions(1);

            write("pnpm-workspace.yaml", "minimumReleaseAge: 1440\n");

            expect(addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["react", "react", "vue"]).added).toStrictEqual(["react", "vue"]);
        });

        it("is a no-op when every name is already excluded", () => {
            expect.assertions(2);

            const before = "minimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - react\n";

            write("pnpm-workspace.yaml", before);

            expect(addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["react"]).added).toStrictEqual([]);
            expect(readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8")).toBe(before);
        });

        it("is a no-op when pnpm has no native gate (minimumReleaseAge unset)", () => {
            expect.assertions(2);

            const before = "packages:\n  - 'packages/*'\n";

            write("pnpm-workspace.yaml", before);

            expect(addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["react"]).added).toStrictEqual([]);
            expect(readFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "utf8")).toBe(before);
        });

        it("is a no-op when the gate is explicitly disabled (minimumReleaseAge: 0)", () => {
            expect.assertions(1);

            write("pnpm-workspace.yaml", "minimumReleaseAge: 0\n");

            expect(addReleaseAgeExcludesForInstall("pnpm", workspaceRoot, ["react"]).added).toStrictEqual([]);
        });
    });

    describe("bun", () => {
        it("adds the selected packages to minimumReleaseAgeExcludes in bunfig.toml", () => {
            expect.assertions(2);

            // 4320 minutes = 259200 seconds (bun's native unit).
            write("bunfig.toml", "[install]\nminimumReleaseAge = 259200\n");

            const { added } = addReleaseAgeExcludesForInstall("bun", workspaceRoot, ["react"]);

            expect(added).toStrictEqual(["react"]);
            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "bun").excludes).toStrictEqual(["react"]);
        });

        it("merges into existing bun excludes without duplicating", () => {
            expect.assertions(1);

            write("bunfig.toml", "[install]\nminimumReleaseAge = 259200\nminimumReleaseAgeExcludes = [\"typescript\"]\n");

            addReleaseAgeExcludesForInstall("bun", workspaceRoot, ["typescript", "react"]);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "bun").excludes).toStrictEqual(["typescript", "react"]);
        });
    });

    describe("yarn", () => {
        it("adds the selected packages to npmPreapprovedPackages in .yarnrc.yml", () => {
            expect.assertions(2);

            write(".yarnrc.yml", "npmMinimalAgeGate: 1440\n");

            const { added } = addReleaseAgeExcludesForInstall("yarn", workspaceRoot, ["react"]);

            expect(added).toStrictEqual(["react"]);
            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "yarn").excludes).toStrictEqual(["react"]);
        });

        it("preserves pre-existing npmPreapprovedPackages (non-destructive merge)", () => {
            expect.assertions(1);

            write(".yarnrc.yml", "npmMinimalAgeGate: 1440\nnpmPreapprovedPackages:\n  - typescript\n");

            addReleaseAgeExcludesForInstall("yarn", workspaceRoot, ["react"]);

            expect(readPmNativeMinimumReleaseAge(workspaceRoot, "yarn").excludes).toStrictEqual(["typescript", "react"]);
        });
    });

    describe("npm", () => {
        it("reports unsupported when a gate is active (npm has no per-package exclude list)", () => {
            expect.assertions(2);

            write(".npmrc", "min-release-age=2\n");

            const { added, unsupported } = addReleaseAgeExcludesForInstall("npm", workspaceRoot, ["react"]);

            expect(added).toStrictEqual([]);
            expect(unsupported).toBe(true);
        });

        it("is not flagged unsupported when npm has no gate at all", () => {
            expect.assertions(1);

            write(".npmrc", "registry=https://registry.npmjs.org/\n");

            expect(addReleaseAgeExcludesForInstall("npm", workspaceRoot, ["react"]).unsupported).toBe(false);
        });
    });
});
