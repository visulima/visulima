import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findPatchIssues, readPatchedDependencies } from "../../src/util/patched-dependencies";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

describe(readPatchedDependencies, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-patched-deps-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    describe("pnpm", () => {
        it("reads patchedDependencies from pnpm-workspace.yaml", () => {
            expect.assertions(3);

            writeFileSync(
                join(workspaceRoot, "pnpm-workspace.yaml"),
                "patchedDependencies:\n  lodash@4.17.21: patches/lodash.patch\n  '@types/node@20.0.0': patches/types-node.patch\n",
            );

            const entries = readPatchedDependencies(workspaceRoot, "pnpm");

            expect(entries).toHaveLength(2);
            expect(entries.find((entry) => entry.name === "lodash")).toMatchObject({
                name: "lodash",
                patchFile: "patches/lodash.patch",
                version: "4.17.21",
            });
            // Scoped name must be preserved verbatim — the parser must not
            // chop off the leading `@scope/`.
            expect(entries.find((entry) => entry.name === "@types/node")).toMatchObject({
                name: "@types/node",
                version: "20.0.0",
            });
        });

        it("returns empty array when pnpm-workspace.yaml is absent", () => {
            expect.assertions(1);

            expect(readPatchedDependencies(workspaceRoot, "pnpm")).toStrictEqual([]);
        });

        it("returns empty array when pnpm-workspace.yaml has no patchedDependencies field", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

            expect(readPatchedDependencies(workspaceRoot, "pnpm")).toStrictEqual([]);
        });
    });

    describe("bun", () => {
        it("reads patchedDependencies from package.json — NOT pnpm-workspace.yaml", () => {
            expect.assertions(2);

            // Both files present with conflicting entries — bun must
            // pick package.json, never the pnpm yaml.
            writeFileSync(
                join(workspaceRoot, "package.json"),
                JSON.stringify(
                    {
                        name: "root",
                        patchedDependencies: { "react@18.2.0": "patches/react.patch" },
                    },
                    undefined,
                    2,
                ),
            );
            writeFileSync(
                join(workspaceRoot, "pnpm-workspace.yaml"),
                "patchedDependencies:\n  ghost@1.0.0: patches/should-be-ignored.patch\n",
            );

            const entries = readPatchedDependencies(workspaceRoot, "bun");

            expect(entries).toHaveLength(1);
            expect(entries[0]).toMatchObject({
                name: "react",
                patchFile: "patches/react.patch",
                version: "18.2.0",
            });
        });

        it("returns empty array when package.json has no patchedDependencies", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }, undefined, 2));

            expect(readPatchedDependencies(workspaceRoot, "bun")).toStrictEqual([]);
        });
    });

    describe("unsupported package managers", () => {
        it("returns empty array for npm/yarn (different patch formats)", () => {
            // Yarn uses `resolutions` with `patch:` URLs, npm has no
            // first-party patch system. We deliberately don't try to
            // read either — they need their own readers if/when added.
            expect.assertions(2);

            writeFileSync(
                join(workspaceRoot, "package.json"),
                JSON.stringify({ name: "root", patchedDependencies: { "lodash@4.17.21": "patches/x.patch" } }, undefined, 2),
            );

            expect(readPatchedDependencies(workspaceRoot, "npm")).toStrictEqual([]);
            expect(readPatchedDependencies(workspaceRoot, "yarn")).toStrictEqual([]);
        });
    });

    describe("malformed input", () => {
        it("ignores entries whose value is not a non-empty string", () => {
            expect.assertions(1);

            writeFileSync(
                join(workspaceRoot, "package.json"),
                JSON.stringify(
                    {
                        name: "root",
                        patchedDependencies: {
                            "good@1.0.0": "patches/good.patch",
                            "missing-value@1.0.0": "",
                            "wrong-type@1.0.0": 42,
                        },
                    },
                    undefined,
                    2,
                ),
            );

            const entries = readPatchedDependencies(workspaceRoot, "bun");

            expect(entries.map((entry) => entry.name)).toStrictEqual(["good"]);
        });

        it("ignores entries whose key doesn't parse as <name>@<version>", () => {
            expect.assertions(1);

            writeFileSync(
                join(workspaceRoot, "package.json"),
                JSON.stringify(
                    {
                        name: "root",
                        patchedDependencies: {
                            "no-at-sign": "patches/x.patch",
                            "valid@1.0.0": "patches/valid.patch",
                        },
                    },
                    undefined,
                    2,
                ),
            );

            const entries = readPatchedDependencies(workspaceRoot, "bun");

            expect(entries.map((entry) => entry.name)).toStrictEqual(["valid"]);
        });

        it("returns empty array when package.json is corrupt JSON", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "package.json"), "{ this is not valid json");

            expect(readPatchedDependencies(workspaceRoot, "bun")).toStrictEqual([]);
        });
    });
});

describe(findPatchIssues, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-patched-deps-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("flags entries whose patch file does not exist on disk", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "package.json"),
            JSON.stringify(
                {
                    name: "root",
                    patchedDependencies: {
                        "ghost@2.0.0": "patches/missing.patch",
                        "lodash@4.17.21": "patches/lodash.patch",
                    },
                },
                undefined,
                2,
            ),
        );
        // Create only one of the two referenced patch files.
        mkdirSync(join(workspaceRoot, "patches"), { recursive: true });
        writeFileSync(join(workspaceRoot, "patches", "lodash.patch"), "diff --git a/x b/x\n");

        const entries = readPatchedDependencies(workspaceRoot, "bun");
        const issues = findPatchIssues(entries);

        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            entry: { name: "ghost", patchFile: "patches/missing.patch", version: "2.0.0" },
            kind: "missing-file",
        });
    });

    it("returns empty array when every patch file exists", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "package.json"),
            JSON.stringify({ name: "root", patchedDependencies: { "lodash@4.17.21": "patches/lodash.patch" } }, undefined, 2),
        );
        mkdirSync(join(workspaceRoot, "patches"), { recursive: true });
        writeFileSync(join(workspaceRoot, "patches", "lodash.patch"), "diff --git a/x b/x\n");

        const entries = readPatchedDependencies(workspaceRoot, "bun");

        expect(findPatchIssues(entries)).toStrictEqual([]);
    });
});
