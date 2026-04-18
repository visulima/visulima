import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTemplate } from "../../src/generate/runner";
import type { Template } from "../../src/generate/types";

let workspace: string;

beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "vis-runner-safety-"));
});

afterEach(() => {
    rmSync(workspace, { force: true, recursive: true });
});

const makeTemplate = (files: Template extends { produce: (...arguments_: unknown[]) => infer R } ? (R extends Promise<infer U> ? U : R) : never): Template => {
    return {
        about: { description: "t", name: "t" },
        produce: () => files,
    };
};

describe("path traversal guard", () => {
    it("should reject `..`-escaping relative paths", async () => {
        expect.assertions(1);

        const template = makeTemplate({
            files: {
                "../escaped.txt": "nope",
            },
        });

        await expect(
            runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                options: {},
                workspaceRoot: workspace,
            }),
        ).rejects.toThrow(/outside destination/i);
    });

    it("should reject absolute-path keys", async () => {
        expect.assertions(1);

        const template = makeTemplate({
            files: {
                "/etc/passwd": "nope",
            },
        });

        await expect(
            runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                options: {},
                workspaceRoot: workspace,
            }),
        ).rejects.toThrow(/absolute path/i);
    });

    it("should reject `..`-escape in nested directory form", async () => {
        expect.assertions(1);

        const template = makeTemplate({
            files: {
                "..": {
                    "..": {
                        "escaped.txt": "nope",
                    },
                },
            },
        });

        await expect(
            runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                options: {},
                workspaceRoot: workspace,
            }),
        ).rejects.toThrow(/outside destination/i);
    });

    it("should apply the guard in dry-run mode too", async () => {
        expect.assertions(1);

        const template = makeTemplate({
            files: {
                "../escaped.txt": "nope",
            },
        });

        await expect(
            runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                dryRun: true,
                options: {},
                workspaceRoot: workspace,
            }),
        ).rejects.toThrow(/outside destination/i);
    });
});

describe("per-file force (filesMeta)", () => {
    it("should overwrite a file when filesMeta declares force, even without --force", async () => {
        expect.assertions(1);

        const { writeFileSync } = await import("node:fs");

        writeFileSync(join(workspace, "forced.txt"), "OLD");
        writeFileSync(join(workspace, "kept.txt"), "KEEP");

        const template = makeTemplate({
            files: {
                "forced.txt": "NEW",
                "kept.txt": "WOULD-OVERWRITE",
            },
            filesMeta: {
                "forced.txt": { force: true },
            },
        });

        await runTemplate(template, {
            cwd: workspace,
            destination: workspace,
            options: {},
            workspaceRoot: workspace,
        });

        const { readFileSync } = await import("node:fs");

        expect({
            forced: readFileSync(join(workspace, "forced.txt"), "utf8"),
            kept: readFileSync(join(workspace, "kept.txt"), "utf8"),
        }).toStrictEqual({ forced: "NEW", kept: "KEEP" });
    });
});

describe("scripts execution", () => {
    it("should invoke a string script in the destination directory", async () => {
        expect.assertions(1);

        const template: Template = {
            about: { description: "t", name: "t" },
            produce: () => {
                return {
                    files: {
                        "marker.txt": "before",
                    },
                    // Use a shell redirect that the destination cwd must honour;
                    // if the script runs elsewhere the file won't be updated.
                    scripts: ["echo ran > ran.txt"],
                };
            },
        };

        await runTemplate(template, {
            cwd: workspace,
            destination: workspace,
            options: {},
            workspaceRoot: workspace,
        });

        const { readFileSync } = await import("node:fs");

        expect(readFileSync(join(workspace, "ran.txt"), "utf8").trim()).toBe("ran");
    });

    it("should skip scripts when --skip-scripts is set", async () => {
        expect.assertions(1);

        const template: Template = {
            about: { description: "t", name: "t" },
            produce: () => {
                return {
                    files: { "a.txt": "x" },
                    scripts: ["echo ran > ran.txt"],
                };
            },
        };

        await runTemplate(template, {
            cwd: workspace,
            destination: workspace,
            options: {},
            skipScripts: true,
            workspaceRoot: workspace,
        });

        const { existsSync } = await import("node:fs");

        expect(existsSync(join(workspace, "ran.txt"))).toBe(false);
    });

    it("should not run scripts in dry-run mode", async () => {
        expect.assertions(1);

        const template: Template = {
            about: { description: "t", name: "t" },
            produce: () => {
                return {
                    files: { "a.txt": "x" },
                    scripts: ["echo ran > ran.txt"],
                };
            },
        };

        await runTemplate(template, {
            cwd: workspace,
            destination: workspace,
            dryRun: true,
            options: {},
            workspaceRoot: workspace,
        });

        const { existsSync } = await import("node:fs");

        expect(existsSync(join(workspace, "ran.txt"))).toBe(false);
    });
});
