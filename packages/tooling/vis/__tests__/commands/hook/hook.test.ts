import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hookScript, installHooks } from "../../../src/commands/hook/install";
import { cleanPackageJsonScripts, detectHuskyDirectory, detectPackageManager, transformHookScript } from "../../../src/commands/hook/migrate";
import { uninstallHooks } from "../../../src/commands/hook/uninstall";

const DIRNAME_LINE_RE = /^d=(.+)$/m;
const DIRNAME_COUNT_RE = /dirname/g;

const countDirnameCalls = (script: string): number => {
    const match = DIRNAME_LINE_RE.exec(script);

    if (!match) {
        return 0;
    }

    return (match[1]?.match(DIRNAME_COUNT_RE) ?? []).length;
};

/**
 * Git exports `GIT_DIR`, `GIT_INDEX_FILE` and friends into hook processes, so
 * these tests retarget the outer repo when the suite runs from a pre-commit
 * hook. Clear them for the duration so every git call resolves from cwd.
 */
const INHERITED_GIT_VARS = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_PREFIX", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];

const detachGitEnvironment = (): (() => void) => {
    const saved = new Map(INHERITED_GIT_VARS.map((name) => [name, process.env[name]]));

    for (const name of INHERITED_GIT_VARS) {
        Reflect.deleteProperty(process.env, name);
    }

    return () => {
        for (const [name, value] of saved) {
            if (value === undefined) {
                Reflect.deleteProperty(process.env, name);
            } else {
                process.env[name] = value;
            }
        }
    };
};

/**
 * Creates a temp directory with `git init` and returns cleanup helpers.
 * execSync used with hardcoded "git init" — no user input, safe for test setup.
 */
const createTemporaryGitRepo = (): { cleanup: () => void; restore: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-hook-test-"));
    const originalCwd = process.cwd();
    const restoreEnvironment = detachGitEnvironment();

    execSync("git init", { cwd: root, stdio: "ignore" });
    process.chdir(root);

    return {
        cleanup: () => {
            process.chdir(originalCwd);
            restoreEnvironment();
            rmSync(root, { force: true, recursive: true });
        },
        restore: () => {
            process.chdir(originalCwd);
            restoreEnvironment();
        },
        root,
    };
};

const createTemporaryDirectory = (): { cleanup: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-hook-test-"));

    return {
        cleanup: () => {
            rmSync(root, { force: true, recursive: true });
        },
        root,
    };
};

const commitEmpty = (root: string): void => {
    execSync("git config user.email vis@example.com", { cwd: root, stdio: "ignore" });
    execSync("git config user.name vis", { cwd: root, stdio: "ignore" });
    execSync("git config commit.gpgsign false", { cwd: root, stdio: "ignore" });
    execSync("git commit -q --allow-empty -m init", { cwd: root, stdio: "ignore" });
};

describe(hookScript, () => {
    it("should compute correct depth for simple dir", () => {
        expect.assertions(1);

        const script = hookScript(".husky");

        expect(countDirnameCalls(script)).toBe(3);
    });

    it("should compute correct depth for nested dir", () => {
        expect.assertions(1);

        const script = hookScript(".vis/hooks");

        expect(countDirnameCalls(script)).toBe(4);
    });

    it("should handle ./ prefix correctly", () => {
        expect.assertions(2);

        const withDot = hookScript("./.config/husky");
        const withoutDot = hookScript(".config/husky");

        expect(countDirnameCalls(withDot)).toBe(countDirnameCalls(withoutDot));
        expect(countDirnameCalls(withDot)).toBe(4);
    });

    it("should handle ./ prefix for simple dir", () => {
        expect.assertions(2);

        const withDot = hookScript("./custom-hooks");
        const withoutDot = hookScript("custom-hooks");

        expect(countDirnameCalls(withDot)).toBe(countDirnameCalls(withoutDot));
        expect(countDirnameCalls(withDot)).toBe(3);
    });

    it("should start with shebang", () => {
        expect.assertions(1);

        const script = hookScript(".vis/hooks");

        expect(script.startsWith("#!/usr/bin/env sh")).toBe(true);
    });

    it("should include VIS_GIT_HOOKS environment variable checks", () => {
        expect.assertions(1);

        const script = hookScript(".vis/hooks");

        expect(script).toContain("VIS_GIT_HOOKS");
    });

    it("should not bake a CI skip guard by default", () => {
        expect.assertions(2);

        const script = hookScript(".vis/hooks");

        expect(script).not.toContain("${CI-}");
        // The blank line between the disable-guard and the `d=` assignment
        // is preserved when no CI guard is injected.
        expect(script).toContain("{ [ \"${VIS_GIT_HOOKS-}\" = \"0\" ]; } && exit 0\n\nd=");
    });

    it("should bake a CI skip guard when skipInCI is set", () => {
        expect.assertions(3);

        const script = hookScript(".vis/hooks", { skipInCI: true });

        // Skips under any non-empty $CI, unless VIS_GIT_HOOKS=1 forces it on.
        expect(script).toContain("{ [ -n \"${CI-}\" ] && [ \"${VIS_GIT_HOOKS-}\" != \"1\" ]; } && exit 0");
        // Ordered AFTER the VIS_GIT_HOOKS=0 kill switch so 0 still wins.
        expect(script.indexOf("= \"0\" ]; } && exit 0")).toBeLessThan(script.indexOf("[ -n \"${CI-}\" ]"));
        // ...and before the hook body actually runs.
        expect(script.indexOf("[ -n \"${CI-}\" ]")).toBeLessThan(script.indexOf("sh -e \"$s\""));
    });
});

describe(installHooks, () => {
    it.skipIf(process.platform === "win32")("should create internal dispatcher scripts but not user hooks", () => {
        expect.assertions(7);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toBe("");

            // Internal dispatchers exist
            expect(existsSync(join(root, ".vis/hooks", "_", "pre-commit"))).toBe(true);
            expect(existsSync(join(root, ".vis/hooks", "_", "commit-msg"))).toBe(true);
            expect(existsSync(join(root, ".vis/hooks", "_", "h"))).toBe(true);
            expect(existsSync(join(root, ".vis/hooks", "_", ".gitignore"))).toBe(true);

            // User hook scripts are NOT created
            expect(existsSync(join(root, ".vis/hooks", "pre-commit"))).toBe(false);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should bake the CI skip guard into the dispatcher when config.json sets skipInCI", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            mkdirSync(join(root, ".vis/hooks"), { recursive: true });
            writeFileSync(join(root, ".vis/hooks", "config.json"), JSON.stringify({ skipInCI: true, stages: {}, version: 1 }));

            installHooks(".vis/hooks");
            const dispatcher = readFileSync(join(root, ".vis/hooks", "_", "h"), "utf8");

            expect(dispatcher).toContain("{ [ -n \"${CI-}\" ] && [ \"${VIS_GIT_HOOKS-}\" != \"1\" ]; } && exit 0");

            // Without the opt-in the guard stays out (default config).
            writeFileSync(join(root, ".vis/hooks", "config.json"), JSON.stringify({ stages: {}, version: 1 }));
            installHooks(".vis/hooks");

            expect(readFileSync(join(root, ".vis/hooks", "_", "h"), "utf8")).not.toContain("${CI-}");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should set core.hooksPath", () => {
        expect.assertions(1);

        const { cleanup } = createTemporaryGitRepo();

        try {
            installHooks(".vis/hooks");

            const hooksPath = execSync("git config --local core.hooksPath", { encoding: "utf8" }).trim();

            expect(hooksPath).toBe(".vis/hooks/_");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("migrates a legacy .vis-hooks directory to .vis/hooks", () => {
        expect.assertions(5);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // Simulate a pre-1.0 install: legacy dir with a user script + a stale hooksPath.
            mkdirSync(join(root, ".vis-hooks"), { recursive: true });
            writeFileSync(join(root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\necho hi\n");
            execSync("git config core.hooksPath .vis-hooks/_", { stdio: "ignore" });

            const result = installHooks();

            expect(result.isError).toBe(false);
            expect(result.message).toContain("migrated");
            // The user script moved across and the legacy dir is gone.
            expect(existsSync(join(root, ".vis/hooks", "pre-commit"))).toBe(true);
            expect(existsSync(join(root, ".vis-hooks"))).toBe(false);

            const hooksPath = execSync("git config --local core.hooksPath", { encoding: "utf8" }).trim();

            expect(hooksPath).toBe(".vis/hooks/_");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should reject paths containing ..", () => {
        expect.assertions(2);

        const { cleanup } = createTemporaryGitRepo();

        try {
            const result = installHooks("../evil-dir");

            expect(result.isError).toBe(true);
            expect(result.message).toContain("..");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should skip when VIS_GIT_HOOKS=0", () => {
        expect.assertions(2);

        const { cleanup } = createTemporaryGitRepo();

        try {
            process.env["VIS_GIT_HOOKS"] = "0";

            const result = installHooks();

            expect(result.isError).toBe(false);
            expect(result.message).toContain("disabled");
        } finally {
            delete process.env["VIS_GIT_HOOKS"];
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should skip with a warning when core.hooksPath points at another tool's populated hooks", () => {
        expect.assertions(4);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            mkdirSync(join(root, ".other-hooks"), { recursive: true });
            writeFileSync(join(root, ".other-hooks", "pre-commit"), "#!/usr/bin/env sh\n", { mode: 0o755 });
            execSync("git config core.hooksPath .other-hooks", { stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(result.isWarning).toBe(true);
            expect(result.message).toContain("already set");
            // The message has to name the way out, or the repo stays stuck here forever.
            expect(result.message).toContain("--force");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should fail when core.hooksPath points at a directory with no hooks", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // What `.git/hooks` looks like: samples only, so git runs nothing.
            mkdirSync(join(root, ".empty-hooks"), { recursive: true });
            writeFileSync(join(root, ".empty-hooks", "pre-commit.sample"), "#!/usr/bin/env sh\n");
            execSync("git config core.hooksPath .empty-hooks", { stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(true);
            expect(result.message).toContain("no hooks");
            expect(result.message).toContain("--force");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should take over an unexpected core.hooksPath with force", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            mkdirSync(join(root, ".other-hooks"), { recursive: true });
            writeFileSync(join(root, ".other-hooks", "pre-commit"), "#!/usr/bin/env sh\n", { mode: 0o755 });
            execSync("git config core.hooksPath .other-hooks", { stdio: "ignore" });

            const result = installHooks(".vis/hooks", { force: true });

            expect(result.isError).toBe(false);
            expect(execSync("git config --local core.hooksPath", { encoding: "utf8" }).trim()).toBe(".vis/hooks/_");
            expect(existsSync(join(root, ".vis", "hooks", "_", "pre-commit"))).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should install a dispatcher into every linked worktree", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();
        const { cleanup: cleanupWorktree, root: worktreeParent } = createTemporaryDirectory();
        const worktree = join(worktreeParent, "wt");

        try {
            commitEmpty(root);
            execFileSync("git", ["worktree", "add", "-q", worktree, "-b", "wt"], { cwd: root, stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, ".vis", "hooks", "_", "pre-commit"))).toBe(true);
            // `core.hooksPath` is shared but resolved per checkout — without a
            // dispatcher here the worktree commits with no hooks at all.
            expect(existsSync(join(worktree, ".vis", "hooks", "_", "pre-commit"))).toBe(true);
        } finally {
            execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: root, stdio: "ignore" });
            cleanupWorktree();
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should adopt an existing vis hooksPath anchored at another checkout prefix", () => {
        expect.assertions(3);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // What a repo installed from `packages/app` looks like from the
            // root of a freshly added worktree: same hooks dir, different
            // prefix. Treating it as a foreign path made install refuse to
            // create the very dispatcher it exists to create.
            execSync("git config core.hooksPath packages/app/.vis/hooks/_", { cwd: root, stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, "packages", "app", ".vis", "hooks", "_", "pre-commit"))).toBe(true);
            // The repo-wide path must not move just because cwd differs.
            expect(execSync("git config --local core.hooksPath", { encoding: "utf8" }).trim()).toBe("packages/app/.vis/hooks/_");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should not error when core.hooksPath is the git-native /dev/null disable", () => {
        expect.assertions(2);

        const { cleanup } = createTemporaryGitRepo();

        try {
            execSync("git config core.hooksPath /dev/null", { stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            // Deliberate, not broken — failing here would break `pnpm install`
            // through the `prepare` script.
            expect(result.isError).toBe(false);
            expect(result.isWarning).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should treat a hooks directory of unsupported stages as populated", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // `reference-transaction` is a real git hook vis writes no shim
            // for. Calling that "no hooks" would block install on a working setup.
            mkdirSync(join(root, ".other-hooks"), { recursive: true });
            writeFileSync(join(root, ".other-hooks", "reference-transaction"), "#!/usr/bin/env sh\n", { mode: 0o755 });
            execSync("git config core.hooksPath .other-hooks", { stdio: "ignore" });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(result.isWarning).toBe(true);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should not resurrect a deleted worktree directory", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();
        const { cleanup: cleanupWorktree, root: worktreeParent } = createTemporaryDirectory();
        const worktree = join(worktreeParent, "gone");

        try {
            commitEmpty(root);
            execFileSync("git", ["worktree", "add", "-q", worktree, "-b", "gone"], { cwd: root, stdio: "ignore" });
            rmSync(worktree, { force: true, recursive: true });

            const result = installHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(existsSync(worktree)).toBe(false);
        } finally {
            cleanupWorktree();
            cleanup();
        }
    });
});

describe(uninstallHooks, () => {
    it.skipIf(process.platform === "win32")("should unset core.hooksPath and remove internal directory", () => {
        expect.assertions(5);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // Install first
            installHooks(".vis/hooks");

            expect(existsSync(join(root, ".vis/hooks", "_"))).toBe(true);

            // Uninstall
            const result = uninstallHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toBe("");
            expect(existsSync(join(root, ".vis/hooks", "_"))).toBe(false);

            // core.hooksPath should be unset

            const checkResult = execSync("git config --local core.hooksPath 2>&1 || true", { encoding: "utf8" });

            expect(checkResult.trim()).toBe("");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should return message when no hooks path is configured", () => {
        expect.assertions(2);

        const { cleanup } = createTemporaryGitRepo();

        try {
            const result = uninstallHooks(".vis/hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toContain("No custom hooks path");
        } finally {
            cleanup();
        }
    });
});

describe(transformHookScript, () => {
    it("should remove common.sh sourcing line", () => {
        expect.assertions(3);

        const input = `#!/bin/sh

. "$(dirname "$0")/common.sh"

echo "hello"
`;
        const result = transformHookScript(input);

        expect(result).not.toContain("common.sh");
        expect(result).toContain("echo \"hello\"");
        expect(result).toContain("#!/bin/sh");
    });

    it("should leave scripts without common.sh unchanged", () => {
        expect.assertions(1);

        const input = `#!/bin/sh

echo "hello"
`;
        const result = transformHookScript(input);

        expect(result).toBe(input);
    });

    it("should only remove the sourcing line, not other references", () => {
        expect.assertions(2);

        const input = `#!/bin/sh

. "$(dirname "$0")/common.sh"

# This references common.sh in a comment
echo "done"
`;
        const result = transformHookScript(input);

        expect(result).toContain("common.sh in a comment");
        expect(result).not.toContain(". \"$(dirname \"$0\")/common.sh\"");
    });
});

describe(detectHuskyDirectory, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should detect .husky directory", () => {
        expect.assertions(1);

        mkdirSync(join(temporary.root, ".husky"));

        expect(detectHuskyDirectory(temporary.root)).toBe(".husky");
    });

    it("should detect .config/husky directory", () => {
        expect.assertions(1);

        mkdirSync(join(temporary.root, ".config", "husky"), { recursive: true });

        expect(detectHuskyDirectory(temporary.root)).toBe(".config/husky");
    });

    it("should prefer .husky over .config/husky", () => {
        expect.assertions(1);

        mkdirSync(join(temporary.root, ".husky"));
        mkdirSync(join(temporary.root, ".config", "husky"), { recursive: true });

        expect(detectHuskyDirectory(temporary.root)).toBe(".husky");
    });

    it("should return undefined when no husky directory exists", () => {
        expect.assertions(1);

        expect(detectHuskyDirectory(temporary.root)).toBeUndefined();
    });

    it("should ignore .husky if it is a file, not a directory", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".husky"), "not a directory");

        expect(detectHuskyDirectory(temporary.root)).toBeUndefined();
    });
});

describe(detectPackageManager, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should detect pnpm from pnpm-lock.yaml", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "pnpm-lock.yaml"), "");

        expect(detectPackageManager(temporary.root)).toBe("pnpm");
    });

    it("should detect pnpm from pnpm-workspace.yaml", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), "");

        expect(detectPackageManager(temporary.root)).toBe("pnpm");
    });

    it("should detect yarn from yarn.lock", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "yarn.lock"), "");

        expect(detectPackageManager(temporary.root)).toBe("yarn");
    });

    it("should detect bun from bun.lockb", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "bun.lockb"), "");

        expect(detectPackageManager(temporary.root)).toBe("bun");
    });

    it("should detect bun from bun.lock", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "bun.lock"), "");

        expect(detectPackageManager(temporary.root)).toBe("bun");
    });

    it("should default to npm when no lockfile found", () => {
        expect.assertions(1);

        expect(detectPackageManager(temporary.root)).toBe("npm");
    });

    it("should prefer pnpm over yarn when both exist", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "pnpm-lock.yaml"), "");
        writeFileSync(join(temporary.root, "yarn.lock"), "");

        expect(detectPackageManager(temporary.root)).toBe("pnpm");
    });
});

describe(cleanPackageJsonScripts, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should remove standalone husky script", () => {
        expect.assertions(3);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ scripts: { prepare: "husky" } }, undefined, 4));

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(true);
        expect(result.removedScriptReferences).toContain("removed \"prepare\" script (was: \"husky\")");

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.scripts.prepare).toBeUndefined();
    });

    it("should remove standalone husky install script", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ scripts: { prepare: "husky install" } }, undefined, 4));

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(true);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.scripts.prepare).toBeUndefined();
    });

    it("should clean husky from compound (is-ci || husky) pattern", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    scripts: {
                        postinstall: "(is-ci || husky || exit 0) && node scripts/setup.js",
                    },
                },
                undefined,
                4,
            ),
        );

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(true);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.scripts.postinstall).toBe("node scripts/setup.js");
    });

    it("should clean husky && from compound commands", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    scripts: { prepare: "husky && lint-staged" },
                },
                undefined,
                4,
            ),
        );

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(true);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.scripts.prepare).toBe("lint-staged");
    });

    it("should not modify scripts without husky references", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    scripts: { build: "tsc", test: "vitest" },
                },
                undefined,
                4,
            ),
        );

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(false);
        expect(result.removedScriptReferences).toHaveLength(0);
    });

    it("should return not modified when no package.json exists", () => {
        expect.assertions(1);

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(false);
    });

    it("should handle package.json without scripts field", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }, undefined, 4));

        const result = cleanPackageJsonScripts(temporary.root);

        expect(result.modified).toBe(false);
    });
});
