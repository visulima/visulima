import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, describe, expect, it } from "vitest";

import { ensureWorkspaceMembership } from "../../src/util/workspace-register";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const created: string[] = [];

/** Create a temp workspace root with the given files, plus a package at packages/foo. */
const makeWorkspace = (files: Record<string, string>): string => {
    const root = createTemporaryDirectory("vis-register-");

    created.push(root);

    for (const [relativePath, content] of Object.entries(files)) {
        const absolute = join(root, relativePath);

        mkdirSync(join(absolute, ".."), { recursive: true });
        writeFileSync(absolute, content);
    }

    // The imported package always exists on disk with its own package.json.
    mkdirSync(join(root, "packages", "foo"), { recursive: true });
    writeFileSync(join(root, "packages", "foo", "package.json"), `${JSON.stringify({ name: "@scope/foo", version: "1.0.0" }, undefined, 4)}\n`);

    return root;
};

describe(ensureWorkspaceMembership, () => {
    afterEach(() => {
        for (const directory of created.splice(0)) {
            cleanupTemporaryDirectory(directory);
        }
    });

    it("reports already-covered without editing when a glob covers the prefix", () => {
        expect.assertions(2);

        const yaml = "packages:\n  - \"packages/**\"\n";
        const root = makeWorkspace({ "pnpm-workspace.yaml": yaml });

        const result = ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root });

        expect(result.status).toBe("already-covered");
        expect(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")).toBe(yaml);
    });

    it("inserts a positive entry into pnpm-workspace.yaml, preserving other lines", () => {
        expect.assertions(4);

        const root = makeWorkspace({ "pnpm-workspace.yaml": "packages:\n  - \"apps/**\"\n  - \"!apps/ignored/**\"\n" });

        const result = ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root });

        expect(result.status).toBe("added");
        expect(result.file).toBe("pnpm-workspace.yaml");

        const content = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain("- \"packages/foo\"");
        expect(content).toContain("- \"!apps/ignored/**\"");
    });

    it("preserves CRLF line endings when inserting into a Windows-style yaml file", () => {
        expect.assertions(3);

        const root = makeWorkspace({ "pnpm-workspace.yaml": "packages:\r\n  - \"apps/**\"\r\n" });

        const result = ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root });

        expect(result.status).toBe("added");

        const content = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain("  - \"packages/foo\"\r\n");
        // No bare LF was introduced: stripping every CRLF pair leaves no \n.
        expect(content.replaceAll("\r\n", "")).not.toContain("\n");
    });

    it("appends to package.json#workspaces when there is no yaml config", () => {
        expect.assertions(3);

        const root = makeWorkspace({ "package.json": `${JSON.stringify({ name: "root", private: true, workspaces: ["apps/*"] }, undefined, 4)}\n` });

        const result = ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root });

        expect(result.status).toBe("added");
        expect(result.file).toBe("package.json");

        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { workspaces: string[] };

        expect(pkg.workspaces).toContain("packages/foo");
    });

    it("does not write anything in dry-run mode", () => {
        expect.assertions(3);

        const yaml = "packages:\n  - \"apps/**\"\n";
        const root = makeWorkspace({ "pnpm-workspace.yaml": yaml });

        const result = ensureWorkspaceMembership({ dryRun: true, prefix: "packages/foo", workspaceRoot: root });

        expect(result.status).toBe("added");
        expect(result.entry).toBe("packages/foo");
        expect(readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")).toBe(yaml);
    });

    it("is idempotent: a second run sees the prefix as already covered", () => {
        expect.assertions(2);

        const root = makeWorkspace({ "pnpm-workspace.yaml": "packages:\n  - \"apps/**\"\n" });

        expect(ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root }).status).toBe("added");
        expect(ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root }).status).toBe("already-covered");
    });

    it("reports no-config when there is no workspace configuration at all", () => {
        expect.assertions(1);

        const root = makeWorkspace({ "package.json": `${JSON.stringify({ name: "root", private: true }, undefined, 4)}\n` });

        expect(ensureWorkspaceMembership({ prefix: "packages/foo", workspaceRoot: root }).status).toBe("no-config");
    });
});
