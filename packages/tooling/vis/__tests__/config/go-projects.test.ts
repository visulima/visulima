import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const write = (root: string, path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
};

/**
 * Go modules listed in `go.work` are task projects only with `go.discover`. The root
 * module is never a task project, and a JS package keeps its own targets.
 */
// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe("go projects as tasks", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "vis-go-tasks-"));
        write(root, "pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write(root, "package.json", JSON.stringify({ name: "root", private: true }));
        write(root, "go.work", "go 1.22\n\nuse (\n\t./core\n\t./cmd/tool\n\t.\n)\n");
        write(root, "core/go.mod", "module github.com/acme/core\n");
        write(root, "cmd/tool/go.mod", "module github.com/acme/tool\n");
        write(root, "go.mod", "module github.com/acme/root\n");
        write(root, "packages/web/package.json", JSON.stringify({ name: "web" }));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("adds the use entries as go task projects with build, test, vet and format:check", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, { go: { discover: true } });
        const targets = workspace.projects["core"]?.targets ?? {};

        expect(workspace.projects["tool"]).toBeDefined();
        expect(Object.keys(targets).sort()).toStrictEqual(["build", "format:check", "test", "vet"]);
        expect(targets["format:check"]).toMatchObject({ command: "gofmt -d ." });
        expect(targets["test"]).toMatchObject({ command: "go test ./..." });
        expect(Object.keys(workspace.projects)).not.toContain("root");
    });

    it("leaves the Go modules out when go.discover is off", () => {
        expect.hasAssertions();

        const { workspace } = discoverWorkspace(root, {});

        expect(workspace.projects["core"]).toBeUndefined();
    });
});
