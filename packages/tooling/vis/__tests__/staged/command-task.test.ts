import { describe, expect, it } from "vitest";

import { validateConfig } from "../../src/staged/config";
import { buildTaskGraph } from "../../src/staged/tasks/build";

const cwd = "/repo";
const workspacePackages = ["/repo/packages/a", "/repo/packages/b", "/repo/packages/group/nested"];
const files = [
    "/repo/packages/a/src/index.ts",
    "/repo/packages/a/src/util.ts",
    "/repo/packages/b/main.ts",
    "/repo/packages/group/nested/deep.ts",
    "/repo/scripts/orphan.ts",
];

describe("command task — perPackage", () => {
    it("fans out one command per owning package with package-relative files", async () => {
        expect.assertions(4);

        const patterns = await buildTaskGraph({
            config: { "**/*.ts": { command: "eslint --fix", perPackage: true } },
            cwd,
            files,
            workspacePackages,
        });

        const commands = patterns[0]?.commands ?? [];
        const byCwd = new Map(commands.map((c) => [c.cwd, c.files]));

        // One command for each of the 3 packages + 1 for the orphan (root cwd).
        expect(commands).toHaveLength(4);
        expect(byCwd.get("/repo/packages/a")).toStrictEqual(["src/index.ts", "src/util.ts"]);
        // The nested package claims its own file, not the outer group dir.
        expect(byCwd.get("/repo/packages/group/nested")).toStrictEqual(["deep.ts"]);
        // Files under no package collapse to a single root-cwd run.
        expect(byCwd.get("/repo")).toStrictEqual(["scripts/orphan.ts"]);
    });

    it("each fanned-out command carries the same command string and a labelled title", async () => {
        expect.assertions(2);

        const patterns = await buildTaskGraph({
            config: { "packages/a/**/*.ts": { command: "eslint --fix", perPackage: true } },
            cwd,
            files,
            workspacePackages,
        });

        const commands = patterns[0]?.commands ?? [];

        expect(commands.map((c) => c.command)).toStrictEqual(["eslint --fix"]);
        expect(commands[0]?.title).toBe("eslint --fix — packages/a");
    });

    it("collapses to a single root-cwd run when no workspace packages are known", async () => {
        expect.assertions(2);

        const patterns = await buildTaskGraph({
            config: { "**/*.ts": { command: "eslint --fix", perPackage: true } },
            cwd,
            files,
            workspacePackages: [],
        });

        const commands = patterns[0]?.commands ?? [];

        expect(commands).toHaveLength(1);
        expect(commands[0]?.cwd).toBe(cwd);
    });
});

describe("command task — fixed cwd", () => {
    it("emits a single command with the resolved cwd and absolute file paths", async () => {
        expect.assertions(3);

        const patterns = await buildTaskGraph({
            config: { "packages/a/**/*.ts": { command: "tsc --noEmit", cwd: "tools/checker" } },
            cwd,
            files,
            workspacePackages,
        });

        const command = patterns[0]?.commands[0];

        expect(patterns[0]?.commands).toHaveLength(1);
        expect(command?.cwd).toBe("/repo/tools/checker");
        // Absolute paths so they resolve from the fixed cwd.
        expect(command?.files).toStrictEqual(["/repo/packages/a/src/index.ts", "/repo/packages/a/src/util.ts"]);
    });
});

describe("command task — plain object form", () => {
    it("behaves like a bare command string when neither cwd nor perPackage is set", async () => {
        expect.assertions(2);

        const patterns = await buildTaskGraph({
            config: { "*.ts": { command: "prettier --write" } },
            cwd,
            files,
            workspacePackages,
        });

        const command = patterns[0]?.commands[0];

        expect(command?.cwd).toBeUndefined();
        expect(command?.command).toBe("prettier --write");
    });
});

describe("command task — validation", () => {
    it("accepts the { command, perPackage } form", () => {
        expect.assertions(1);

        expect(() => validateConfig({ "*.ts": { command: "eslint --fix", perPackage: true } })).not.toThrow();
    });

    it("rejects a command task that also sets task", () => {
        expect.assertions(1);

        expect(() => validateConfig({ "*.ts": { command: "eslint", task: () => undefined, title: "x" } })).toThrow(/both `command` and `task`/u);
    });

    it("rejects an empty command", () => {
        expect.assertions(1);

        expect(() => validateConfig({ "*.ts": { command: "   " } })).toThrow(/empty `command`/u);
    });

    it("still accepts a { title, task } custom task", () => {
        expect.assertions(1);

        expect(() => validateConfig({ "*.ts": { task: () => undefined, title: "custom" } })).not.toThrow();
    });
});
