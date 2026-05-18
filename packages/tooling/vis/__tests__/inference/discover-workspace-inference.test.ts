import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discoverWorkspace } from "../../src/config/workspace";

const writeProject = (
    root: string,
    name: string,
    files: { configFile?: { contents: string; path: string }; packageJson?: Record<string, unknown>; projectJson?: Record<string, unknown> },
): void => {
    const directory = join(root, "packages", name);

    mkdirSync(directory, { recursive: true });

    writeFileSync(join(directory, "package.json"), JSON.stringify({ name: `@fix/${name}`, scripts: {}, ...files.packageJson }, undefined, 2));

    if (files.projectJson) {
        writeFileSync(join(directory, "project.json"), JSON.stringify(files.projectJson, undefined, 2));
    }

    if (files.configFile) {
        writeFileSync(join(directory, files.configFile.path), files.configFile.contents);
    }
};

describe("discoverWorkspace target inference", () => {
    let scratch: string;

    beforeEach(() => {
        scratch = mkdtempSync(join(realpathSync(tmpdir()), "vis-infer-"));
        mkdirSync(join(scratch, "node_modules"), { recursive: true });
        writeFileSync(join(scratch, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
        writeFileSync(join(scratch, "package.json"), JSON.stringify({ name: "fixture-root", private: true }, undefined, 2));
    });

    afterEach(() => {
        rmSync(scratch, { force: true, recursive: true });
    });

    it("infers targets by default when inferTargets is not set", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
        });

        const { workspace } = discoverWorkspace(scratch, {});

        // Inference is on by default — vite.config.ts → build target.
        expect(workspace.projects["@fix/alpha"]?.targets?.["build"]?.command).toBe("vite build");
    });

    it("does nothing when inferTargets is explicitly false", () => {
        expect.assertions(1);

        writeProject(scratch, "alpha", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: false });

        // No scripts, no project.json targets, inference off → no targets at all.
        expect(workspace.projects["@fix/alpha"]?.targets).toStrictEqual({});
    });

    it("enriches a matching script target with detector inputs/outputs", () => {
        expect.assertions(4);

        writeProject(scratch, "zeta", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build --mode production" } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/zeta"]?.targets?.["build"];

        // Script command is preserved verbatim …
        expect(build?.command).toBe("vite build --mode production");
        // … but the detector's inputs/outputs are adopted so it caches.
        expect(build?.outputs).toStrictEqual(["{projectRoot}/dist"]);
        expect(build?.inputs).toBeDefined();
        expect(build?.cache).toBe(true);
    });

    it("defaults a compound script to { auto: true } outputs instead of forcing it cache-cold", () => {
        expect.assertions(3);

        writeProject(scratch, "eta", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build && tsc --emitDeclarationOnly" } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/eta"]?.targets?.["build"];

        expect(build?.command).toBe("vite build && tsc --emitDeclarationOnly");
        // Compound command → detector's precise dist outputs NOT adopted
        // (would be incomplete). Auto-write capture now lets the build
        // cache zero-config: task-runner records whatever it writes and
        // declines to seed the cache if tracking captured nothing.
        expect(build?.outputs).toStrictEqual([{ auto: true }]);
        expect(build?.cache).toBe(true);
    });

    it("leaves a script with no matching detector uncached (no footgun)", () => {
        expect.assertions(2);

        writeProject(scratch, "theta", {
            packageJson: { scripts: { build: "./scripts/make.sh" } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/theta"]?.targets?.["build"];

        expect(build?.command).toBe("./scripts/make.sh");
        // No tool detected → no type adopted → not cached, not auto-captured.
        expect(build?.cache).not.toBe(true);
    });

    it("synthesises vite targets when inferTargets is true", () => {
        expect.assertions(2);

        writeProject(scratch, "alpha", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: true });
        const targets = workspace.projects["@fix/alpha"]?.targets;

        expect(targets?.["build"]?.command).toBe("vite build");
        expect(targets?.["preview"]?.command).toBe("vite preview");
    });

    it("lets a package.json script override an inferred target", () => {
        expect.assertions(1);

        writeProject(scratch, "beta", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "custom-build" } },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: true });

        expect(workspace.projects["@fix/beta"]?.targets?.["build"]?.command).toBe("custom-build");
    });

    it("lets a project.json target override an inferred target", () => {
        expect.assertions(1);

        writeProject(scratch, "gamma", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            projectJson: { targets: { build: { command: "from-project-json" } } },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: true });

        expect(workspace.projects["@fix/gamma"]?.targets?.["build"]?.command).toBe("from-project-json");
    });

    it("infers vitest from devDependencies even without a config file", () => {
        expect.assertions(1);

        writeProject(scratch, "delta", {
            packageJson: { devDependencies: { vitest: "^4.0.0" } },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: true });

        expect(workspace.projects["@fix/delta"]?.targets?.["test"]?.command).toBe("vitest run");
    });

    it("leaves a target that declares its own outputs untouched", () => {
        expect.assertions(3);

        writeProject(scratch, "kappa", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build" } },
            projectJson: { targets: { build: { outputs: ["{projectRoot}/custom-out"] } } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/kappa"]?.targets?.["build"];

        // Script command preserved, and the user's explicit outputs are
        // NOT replaced by the detector's `{projectRoot}/dist`.
        expect(build?.command).toBe("vite build");
        expect(build?.outputs).toStrictEqual(["{projectRoot}/custom-out"]);
        expect(build?.inputs).toBeUndefined();
    });

    it("defaults an explicit cache:true build with no outputs to { auto: true }", () => {
        expect.assertions(2);

        writeProject(scratch, "lambda", {
            packageJson: { scripts: { build: "rspack build" } },
            projectJson: { targets: { build: { cache: true, type: "build" } } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/lambda"]?.targets?.["build"];

        // rspack has no detector → no outputs adopted; an explicit
        // cache:true build now defaults to auto-write capture rather
        // than being forced cold.
        expect(build?.cache).toBe(true);
        expect(build?.outputs).toStrictEqual([{ auto: true }]);
    });

    it("respects per-detector opt-out via the object form", () => {
        expect.assertions(2);

        writeProject(scratch, "epsilon", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { devDependencies: { vitest: "^4.0.0" } },
        });

        const { workspace } = discoverWorkspace(scratch, { inferTargets: { vite: false } });
        const targets = workspace.projects["@fix/epsilon"]?.targets;

        // vite disabled → no `build`/`dev` even though vite.config.ts exists.
        expect(targets?.["build"]).toBeUndefined();
        // vitest still on by default → `test` is still synthesised.
        expect(targets?.["test"]?.command).toBe("vitest run");
    });

    it("emits a once-per-process VisConfigWarning for an unknown detector key (typo insurance)", () => {
        expect.assertions(4);

        const emitWarningSpy = vi.spyOn(process, "emitWarning").mockImplementation(() => {});

        writeProject(scratch, "kappa", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build" } },
        });

        // `vit` is a typo for `vite` — must surface, not silently no-op.
        discoverWorkspace(scratch, { inferTargets: { vit: false } });

        expect(emitWarningSpy).toHaveBeenCalledTimes(1);

        const [message, type] = emitWarningSpy.mock.calls[0] as [string, string];

        expect(message).toContain("inferTargets references unknown detector(s): vit");
        expect(type).toBe("VisConfigWarning");

        // Same unknown key again in-process → deduped, no second warning.
        discoverWorkspace(scratch, { inferTargets: { vit: false } });

        expect(emitWarningSpy).toHaveBeenCalledTimes(1);

        emitWarningSpy.mockRestore();
    });

    it("does not adopt detector outputs for a piped script (unsafe shell composition)", () => {
        expect.assertions(2);

        writeProject(scratch, "lambda", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build | tee build.log" } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/lambda"]?.targets?.["build"];

        // A pipe can route artifacts the single-tool detector never
        // predicted → precise dist outputs are skipped, auto-capture used.
        expect(build?.command).toBe("vite build | tee build.log");
        expect(build?.outputs).toStrictEqual([{ auto: true }]);
    });

    it("does not adopt detector outputs for a script using command substitution", () => {
        expect.assertions(2);

        writeProject(scratch, "mu", {
            configFile: { contents: "export default {}", path: "vite.config.ts" },
            packageJson: { scripts: { build: "vite build --mode $(get-mode)" } },
        });

        const { workspace } = discoverWorkspace(scratch, {});
        const build = workspace.projects["@fix/mu"]?.targets?.["build"];

        expect(build?.command).toBe("vite build --mode $(get-mode)");
        expect(build?.outputs).toStrictEqual([{ auto: true }]);
    });
});
