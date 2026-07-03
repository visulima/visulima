import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const writeProject = (root: string, name: string, projectJson: Record<string, unknown>): void => {
    const directory = join(root, "packages", name);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@fix/${name}`, scripts: {} }, undefined, 2));
    writeFileSync(join(directory, "project.json"), JSON.stringify(projectJson, undefined, 2));
};

describe("workspace.ts eagerly validates URI-form inputs at config-load", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-input-uri-"));
        writeFileSync(join(scratch, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("accepts valid URI-form inputs and lets them flow through unchanged", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            targets: {
                build: {
                    command: "echo build",
                    inputs: ["glob://{projectRoot}/src/**/*", "env://NODE_ENV", "func://node --version"],
                },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const target = workspace.projects["@fix/alpha"]?.targets?.build;

        expect(target?.inputs).toStrictEqual(["glob://{projectRoot}/src/**/*", "env://NODE_ENV", "func://node --version"]);
    });

    it("throws InvalidInputUriError on unknown scheme during discovery", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            targets: {
                build: {
                    command: "echo build",
                    inputs: ["gob://**/*"],
                },
            },
        });

        expect(() => discoverWorkspace(scratch)).toThrow(/Unknown input URI scheme/);
    });

    it("validates URIs that come in via @filegroup expansion", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            targets: {
                build: {
                    command: "echo build",
                    inputs: ["@filegroup:bad"],
                },
            },
        });

        // Provide a vis.config.ts-style fileGroups via the second arg —
        // discoverWorkspace accepts an explicit config object, which is
        // what ConfigLoader hands it after merging the file/programmatic
        // sources.
        expect(() =>
            discoverWorkspace(scratch, {
                fileGroups: {
                    bad: ["typo://oops"],
                },
            }),
        ).toThrow(/Unknown input URI scheme/);
    });

    it("flags trailing-comma typos in dep:// at config-load", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            targets: {
                build: {
                    command: "echo build",
                    inputs: ["dep://typescript,"],
                },
            },
        });

        expect(() => discoverWorkspace(scratch)).toThrow(/empty dependency segment/);
    });
});
