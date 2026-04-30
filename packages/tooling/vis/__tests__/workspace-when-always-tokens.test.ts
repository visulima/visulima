import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../src/config/workspace";

const writeProject = (root: string, name: string, projectJson: Record<string, unknown>, scripts?: Record<string, string>): void => {
    const directory = join(root, "packages", name);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@fix/${name}`, scripts: scripts ?? {} }, undefined, 2));
    writeFileSync(join(directory, "project.json"), JSON.stringify(projectJson, undefined, 2));
};

describe("workspace.ts forwards when/always/tokens to task-runner shape", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-when-always-"));
        // Vis discovers via pnpm-workspace.yaml first; provide one so the
        // fixture is unambiguous regardless of the host's package manager.
        writeFileSync(join(scratch, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("passes when: through to the sanitized task-runner target", () => {
        expect.assertions(2);

        writeProject(scratch, "alpha", {
            targets: {
                deploy: {
                    command: "echo deploy",
                    when: { branch: ["main", "alpha"], ci: true, env: { exists: true, name: "DEPLOY_TOKEN" } },
                },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const target = workspace.projects["@fix/alpha"]?.targets?.deploy;

        expect(target).toBeDefined();
        expect(target?.when).toStrictEqual({
            branch: ["main", "alpha"],
            ci: true,
            env: { exists: true, name: "DEPLOY_TOKEN" },
        });
    });

    it("passes always: through and preserves it on cleanup tasks", () => {
        expect.assertions(2);

        writeProject(scratch, "beta", {
            targets: {
                "stop-db": { always: true, command: "echo down" },
                test: { command: "echo test" },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const targets = workspace.projects["@fix/beta"]?.targets;

        expect(targets?.test?.always).toBeUndefined();
        expect(targets?.["stop-db"]?.always).toBe(true);
    });

    it("preserves ${affected.files} tokens verbatim — task-runner expands them later", () => {
        expect.assertions(2);

        writeProject(scratch, "gamma", {
            targets: {
                lint: { command: "eslint ${affected.files}" },
                stylelint: { command: "stylelint ${changed_files | flag '--file'}" },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const targets = workspace.projects["@fix/gamma"]?.targets;

        expect(targets?.lint?.command).toBe("eslint ${affected.files}");
        expect(targets?.stylelint?.command).toBe("stylelint ${changed_files | flag '--file'}");
    });

    it("allows when: + always: to compose on the same target", () => {
        expect.assertions(2);

        writeProject(scratch, "delta", {
            targets: {
                "upload-coverage": {
                    always: true,
                    command: "echo upload",
                    when: { ci: true },
                },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const target = workspace.projects["@fix/delta"]?.targets?.["upload-coverage"];

        expect(target?.always).toBe(true);
        expect(target?.when).toStrictEqual({ ci: true });
    });

    it("strips the vis-only `options` block from sanitized targets without dropping when/always", () => {
        // Sanity: workspace.ts at line 1212-1224 spreads `...rest` from the
        // VisTargetConfiguration. `options` is moved through as a generic
        // record but `when`/`always` come from `rest` — this guards against
        // a future refactor accidentally hoisting them into options.
        expect.assertions(3);

        writeProject(scratch, "epsilon", {
            targets: {
                build: {
                    always: false,
                    command: "echo build",
                    options: { runInCI: false },
                    when: { os: "linux" },
                },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const target = workspace.projects["@fix/epsilon"]?.targets?.build;

        expect(target?.when).toStrictEqual({ os: "linux" });
        expect(target?.always).toBe(false);
        expect((target?.options as { runInCI?: unknown } | undefined)?.runInCI).toBe(false);
    });
});
