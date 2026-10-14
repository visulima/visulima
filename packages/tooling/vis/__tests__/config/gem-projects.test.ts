import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveGemProjectDirectories } from "../../src/config/gem-projects";
import { discoverWorkspace } from "../../src/config/workspace";

describe("config: gem directories", () => {
    let root: string;

    const write = (path: string, content: string): void => {
        mkdirSync(join(root, path, ".."), { recursive: true });
        writeFileSync(join(root, path), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-config-")));
        write("pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write("package.json", JSON.stringify({ name: "root", private: true }));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns gem directories, skipping the root, vendor trees and claimed directories", () => {
        expect.hasAssertions();

        for (const dir of ["libs/a", "libs/b", "vendor/c", "js/d"]) {
            write(`${dir}/${dir.split("/").pop()}.gemspec`, "");
        }

        expect(resolveGemProjectDirectories(root, ["js/d"])).toStrictEqual(["libs/a", "libs/b"]);
    });

    it("gives a gemspec-only directory its build target through discoverWorkspace, and no tasks without gem.discover", () => {
        expect.hasAssertions();

        write("libs/a/a.gemspec", "");
        write("packages/web/package.json", JSON.stringify({ name: "web" }));
        write("packages/web/web.gemspec", "");

        expect(discoverWorkspace(root, {}).workspace.projects["a"]).toBeUndefined();

        const { workspace } = discoverWorkspace(root, { gem: { discover: true } });

        expect(workspace.projects["a"]?.targets?.["build"]?.command).toBe("gem build a.gemspec");
        expect(workspace.projects["web"]?.targets?.["build"]).toBeUndefined();
    });
});
