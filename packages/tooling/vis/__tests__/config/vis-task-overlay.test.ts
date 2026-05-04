import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverWorkspace, loadVisTaskConfigsForWorkspace } from "../../src/config/workspace";

const writeProject = (
    root: string,
    name: string,
    files: { packageJson?: Record<string, unknown>; projectJson?: Record<string, unknown>; visTaskTs?: string },
): void => {
    const directory = join(root, "packages", name);

    mkdirSync(directory, { recursive: true });

    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@fix/${name}`, scripts: {}, ...files.packageJson }, undefined, 2));

    if (files.projectJson) {
        writeFileSync(join(directory, "project.json"), JSON.stringify(files.projectJson, undefined, 2));
    }

    if (files.visTaskTs !== undefined) {
        writeFileSync(join(directory, "vis.task.ts"), files.visTaskTs);
    }
};

describe("vis.task.ts per-package overlay", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-task-overlay-"));
        // node_modules has to exist so cache resolution stays inside the
        // fixture (loadVisTaskConfig writes per-project cache files).
        mkdirSync(join(scratch, "node_modules"), { recursive: true });
        writeFileSync(join(scratch, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("returns an empty index when no project ships vis.task.ts", async () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", { projectJson: { targets: { build: { command: "echo build" } } } });

        const index = await loadVisTaskConfigsForWorkspace(scratch);

        expect(index.size).toBe(0);
    });

    it("loads a single vis.task.ts overlay", async () => {
        expect.assertions(2);

        writeProject(scratch, "alpha", {
            projectJson: { targets: { build: { command: "from-project-json" } } },
            visTaskTs: `export default {
    targets: {
        build: { command: "from-vis-task" },
    },
};`,
        });

        const index = await loadVisTaskConfigsForWorkspace(scratch);

        expect(index.size).toBe(1);
        expect(index.get("packages/alpha")?.targets?.build?.command).toBe("from-vis-task");
    });

    it("vis.task.ts targets override project.json targets in discoverWorkspace", async () => {
        expect.assertions(1);

        writeProject(scratch, "beta", {
            projectJson: { targets: { build: { command: "from-project-json", outputs: ["dist/**"] } } },
            visTaskTs: `export default {
    targets: {
        build: { command: "from-vis-task" },
    },
};`,
        });

        const taskConfigs = await loadVisTaskConfigsForWorkspace(scratch);
        const { workspace } = discoverWorkspace(scratch, {}, taskConfigs);

        expect(workspace.projects["@fix/beta"]?.targets?.build?.command).toBe("from-vis-task");
    });

    it("preserves project.json fields the overlay does not redefine", async () => {
        expect.assertions(2);

        writeProject(scratch, "gamma", {
            projectJson: { targets: { build: { command: "from-project-json", outputs: ["dist/**"] } } },
            visTaskTs: `export default {
    targets: {
        build: { command: "from-vis-task" },
    },
};`,
        });

        const taskConfigs = await loadVisTaskConfigsForWorkspace(scratch);
        const { workspace } = discoverWorkspace(scratch, {}, taskConfigs);
        const target = workspace.projects["@fix/gamma"]?.targets?.build;

        expect(target?.command).toBe("from-vis-task");
        expect(target?.outputs).toStrictEqual(["dist/**"]);
    });

    it("supports @inherit in vis.task.ts to extend project.json arrays", async () => {
        expect.assertions(1);

        writeProject(scratch, "delta", {
            projectJson: { targets: { build: { command: "tsc", inputs: ["src/**/*.ts"] } } },
            visTaskTs: `export default {
    targets: {
        build: { inputs: ["@inherit", "proto/**/*.proto"] },
    },
};`,
        });

        const taskConfigs = await loadVisTaskConfigsForWorkspace(scratch);
        const { workspace } = discoverWorkspace(scratch, {}, taskConfigs);

        expect(workspace.projects["@fix/delta"]?.targets?.build?.inputs).toStrictEqual(["src/**/*.ts", "proto/**/*.proto"]);
    });

    it("falls back to project.json when no overlay exists for a project", async () => {
        expect.assertions(2);

        writeProject(scratch, "with-overlay", {
            projectJson: { targets: { build: { command: "from-project-json" } } },
            visTaskTs: `export default { targets: { build: { command: "from-vis-task" } } };`,
        });
        writeProject(scratch, "without-overlay", {
            projectJson: { targets: { build: { command: "from-project-json" } } },
        });

        const taskConfigs = await loadVisTaskConfigsForWorkspace(scratch);
        const { workspace } = discoverWorkspace(scratch, {}, taskConfigs);

        expect(workspace.projects["@fix/with-overlay"]?.targets?.build?.command).toBe("from-vis-task");
        expect(workspace.projects["@fix/without-overlay"]?.targets?.build?.command).toBe("from-project-json");
    });

    it("propagates when:/always: from vis.task.ts to the sanitized target", async () => {
        expect.assertions(2);

        writeProject(scratch, "epsilon", {
            projectJson: { targets: { deploy: { command: "echo deploy" } } },
            visTaskTs: `export default {
    targets: {
        deploy: { when: { ci: true }, always: false },
    },
};`,
        });

        const taskConfigs = await loadVisTaskConfigsForWorkspace(scratch);
        const { workspace } = discoverWorkspace(scratch, {}, taskConfigs);
        const target = workspace.projects["@fix/epsilon"]?.targets?.deploy;

        expect(target?.when).toStrictEqual({ ci: true });
        expect(target?.always).toBe(false);
    });
});
