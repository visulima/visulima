import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { downloadTemplate } from "giget";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { executeBundledTemplate } from "../../../src/commands/create/templates/bundled";
import type { ExecutionContext, TemplateConfig } from "../../../src/commands/create/templates/types";

vi.mock(import("giget"), () => { return { downloadTemplate: vi.fn() }; });

describe(executeBundledTemplate, () => {
    let root: string;
    let targetDir: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-bundled-test-"));
        targetDir = join(root, "target");
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    const context = (): ExecutionContext => {
        return {
            cwd: root,
            inMonorepo: false,
            logger: console,
            pm: { name: "npm", version: "10.0.0" },
            projectName: "target",
            targetDir,
        };
    };

    const config = (subdir: string): TemplateConfig => {
        return {
            args: [],
            source: "https://registry.npmjs.org/@vistest-org/create/-/create-1.0.0.tgz",
            subdir,
            type: "remote:bundled",
        };
    };

    /** Fake giget extraction: the package contents land directly in `dir` (top-level folder stripped). */
    const fakePackage = (build: (packageRoot: string) => void): void => {
        vi.mocked(downloadTemplate).mockImplementationOnce(async (_source, options) => {
            const { dir } = (options as { dir: string });

            build(dir);

            return { dir, source: "", url: "" };
        });
    };

    it("copies the bundled subdirectory and skips symlinks", async () => {
        expect.assertions(3);

        fakePackage((dir) => {
            mkdirSync(join(dir, "templates/app"), { recursive: true });
            writeFileSync(join(dir, "templates/app/package.json"), "{\"name\":\"app\"}");
            symlinkSync("/etc", join(dir, "templates/app/leak"));
        });

        await expect(executeBundledTemplate(config("templates/app"), context())).resolves.toBe(0);
        expect(readFileSync(join(targetDir, "package.json"), "utf8")).toBe("{\"name\":\"app\"}");
        expect(existsSync(join(targetDir, "leak"))).toBe(false);
    });

    it("refuses a subdirectory that is a symlink out of the package", async () => {
        expect.assertions(2);

        const outside = join(root, "outside");

        mkdirSync(outside);
        fakePackage((dir) => {
            mkdirSync(join(dir, "templates"), { recursive: true });
            symlinkSync(outside, join(dir, "templates/escape"));
        });

        await expect(executeBundledTemplate(config("templates/escape"), context())).resolves.toBe(1);
        expect(existsSync(targetDir)).toBe(false);
    });

    it("reports a missing bundled directory as a failure", async () => {
        expect.assertions(1);

        fakePackage(() => {});

        await expect(executeBundledTemplate(config("templates/missing"), context())).resolves.toBe(1);
    });
});
