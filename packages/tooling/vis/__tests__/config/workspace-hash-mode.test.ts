import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const writeProject = (root: string, name: string, projectJson: Record<string, unknown>, scripts?: Record<string, string>): void => {
    const directory = join(root, "packages", name);

    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@fix/${name}`, scripts: scripts ?? {} }, undefined, 2));
    writeFileSync(join(directory, "project.json"), JSON.stringify(projectJson, undefined, 2));
};

describe("workspace.ts forwards hashMode to the task-runner shape", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-hash-mode-"));
        writeFileSync(join(scratch, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("passes a project.json target's hashMode through to the sanitized target", () => {
        expect.assertions(2);

        writeProject(scratch, "alpha", {
            targets: {
                build: { command: "tsc", hashMode: "trace" },
                test: { command: "vitest" },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const targets = workspace.projects["@fix/alpha"]?.targets;

        expect(targets?.build?.hashMode).toBe("trace");
        // Untouched targets stay declared (hashMode undefined).
        expect(targets?.test?.hashMode).toBeUndefined();
    });

    it("applies a config.tasks default hashMode when the project target omits it", () => {
        expect.assertions(1);

        writeProject(scratch, "beta", {
            targets: {
                build: { command: "tsc" },
            },
        });

        const { workspace } = discoverWorkspace(scratch, {
            tasks: { build: { hashMode: "trace" } },
        });

        expect(workspace.projects["@fix/beta"]?.targets?.build?.hashMode).toBe("trace");
    });

    it("lets a project target's hashMode win over the config.tasks default", () => {
        expect.assertions(1);

        writeProject(scratch, "gamma", {
            targets: {
                build: { command: "tsc", hashMode: "declared" },
            },
        });

        const { workspace } = discoverWorkspace(scratch, {
            tasks: { build: { hashMode: "trace" } },
        });

        expect(workspace.projects["@fix/gamma"]?.targets?.build?.hashMode).toBe("declared");
    });

    it("applies a scopedTasks hashMode only to projects whose tag matches", () => {
        expect.assertions(2);

        writeProject(scratch, "delta", {
            tags: ["type:package"],
            targets: { build: { command: "tsc" } },
        });
        writeProject(scratch, "epsilon", {
            tags: ["type:app"],
            targets: { build: { command: "tsc" } },
        });

        const { workspace } = discoverWorkspace(scratch, {
            scopedTasks: [{ match: { tags: ["type:package"] }, tasks: { build: { hashMode: "trace" } } }],
        });

        expect(workspace.projects["@fix/delta"]?.targets?.build?.hashMode).toBe("trace");
        expect(workspace.projects["@fix/epsilon"]?.targets?.build?.hashMode).toBeUndefined();
    });

    it("keeps hashMode on the target through the options-strip sanitization", () => {
        // The sanitization loop deletes inferred/options/preset/type and
        // spreads the rest. hashMode must survive on the target itself and
        // must not be hoisted into the generic options record.
        expect.assertions(2);

        writeProject(scratch, "zeta", {
            targets: {
                build: { command: "tsc", hashMode: "trace", options: { runInCI: false } },
            },
        });

        const { workspace } = discoverWorkspace(scratch);
        const target = workspace.projects["@fix/zeta"]?.targets?.build;

        expect(target?.hashMode).toBe("trace");
        expect((target?.options as { hashMode?: unknown } | undefined)?.hashMode).toBeUndefined();
    });
});
