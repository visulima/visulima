import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTemplate } from "../../src/generate/runner";
import type { Template } from "../../src/generate/types";

describe("runner", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-runner-"));
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    const template: Template = {
        about: { description: "test", name: "test" },
        produce: ({ options }) => {
            return {
                files: {
                    "package.json": JSON.stringify({ name: options.name }, null, 2),
                    src: {
                        "index.ts": "export {};\n",
                    },
                },
                suggestions: ["Run pnpm install"],
            };
        },
    };

    describe(runTemplate, () => {
        it("should write the file tree to the destination", async () => {
            expect.assertions(2);

            await runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                options: { name: "test-pkg" },
                workspaceRoot: workspace,
            });

            const pkg = readFileSync(join(workspace, "package.json"), "utf8");
            const indexFile = readFileSync(join(workspace, "src/index.ts"), "utf8");

            expect(pkg).toContain('"name": "test-pkg"');
            expect(indexFile).toBe("export {};\n");
        });

        it("should not write files in dry-run mode", async () => {
            expect.assertions(1);

            await runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                dryRun: true,
                options: { name: "test-pkg" },
                workspaceRoot: workspace,
            });

            expect(() => readFileSync(join(workspace, "package.json"), "utf8")).toThrow(/ENOENT/);
        });

        it("should skip existing files without --force", async () => {
            expect.assertions(1);

            writeFileSync(join(workspace, "package.json"), "EXISTING");

            await runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                options: { name: "test-pkg" },
                workspaceRoot: workspace,
            });

            expect(readFileSync(join(workspace, "package.json"), "utf8")).toBe("EXISTING");
        });

        it("should overwrite existing files with --force", async () => {
            expect.assertions(1);

            writeFileSync(join(workspace, "package.json"), "EXISTING");

            await runTemplate(template, {
                cwd: workspace,
                destination: workspace,
                force: true,
                options: { name: "test-pkg" },
                workspaceRoot: workspace,
            });

            expect(readFileSync(join(workspace, "package.json"), "utf8")).toContain('"name": "test-pkg"');
        });
    });
});
