import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hookScript, installHooks } from "../../../src/commands/hook/install";
import { cleanPackageJsonScripts, detectHuskyDirectory, detectPackageManager, transformHookScript } from "../../../src/commands/hook/migrate";
import { uninstallHooks } from "../../../src/commands/hook/uninstall";

// ─── Helpers ────────────────────────────────────────────────────────

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
 * Creates a temp directory with `git init` and returns cleanup helpers.
 * execSync used with hardcoded "git init" — no user input, safe for test setup.
 */
const createTemporaryGitRepo = (): { cleanup: () => void; restore: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-hook-test-"));
    const originalCwd = process.cwd();

    execSync("git init", { cwd: root, stdio: "ignore" });
    process.chdir(root);

    return {
        cleanup: () => {
            process.chdir(originalCwd);
            rmSync(root, { force: true, recursive: true });
        },
        restore: () => {
            process.chdir(originalCwd);
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

// ─── hookScript (unit) ──────────────────────────────────────────────

describe(hookScript, () => {
    it("should compute correct depth for simple dir", () => {
        expect.assertions(1);

        const script = hookScript(".vis-hooks");

        expect(countDirnameCalls(script)).toBe(3);
    });

    it("should compute correct depth for nested dir", () => {
        expect.assertions(1);

        const script = hookScript(".config/husky");

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

        const script = hookScript(".vis-hooks");

        expect(script.startsWith("#!/usr/bin/env sh")).toBe(true);
    });

    it("should include VIS_GIT_HOOKS environment variable checks", () => {
        expect.assertions(1);

        const script = hookScript(".vis-hooks");

        expect(script).toContain("VIS_GIT_HOOKS");
    });
});

// ─── installHooks (integration) ─────────────────────────────────────

describe(installHooks, () => {
    it.skipIf(process.platform === "win32")("should create internal dispatcher scripts but not user hooks", () => {
        expect.assertions(7);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            const result = installHooks(".vis-hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toBe("");

            // Internal dispatchers exist
            expect(existsSync(join(root, ".vis-hooks", "_", "pre-commit"))).toBe(true);
            expect(existsSync(join(root, ".vis-hooks", "_", "commit-msg"))).toBe(true);
            expect(existsSync(join(root, ".vis-hooks", "_", "h"))).toBe(true);
            expect(existsSync(join(root, ".vis-hooks", "_", ".gitignore"))).toBe(true);

            // User hook scripts are NOT created
            expect(existsSync(join(root, ".vis-hooks", "pre-commit"))).toBe(false);
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should set core.hooksPath", () => {
        expect.assertions(1);

        const { cleanup } = createTemporaryGitRepo();

        try {
            installHooks(".vis-hooks");

            const hooksPath = execSync("git config --local core.hooksPath", { encoding: "utf8" }).trim();

            expect(hooksPath).toBe(".vis-hooks/_");
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

    it.skipIf(process.platform === "win32")("should skip when core.hooksPath is already set to a different path", () => {
        expect.assertions(2);

        const { cleanup } = createTemporaryGitRepo();

        try {
            execSync("git config core.hooksPath .other-hooks", { stdio: "ignore" });

            const result = installHooks(".vis-hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toContain("already set");
        } finally {
            cleanup();
        }
    });

    it.skipIf(process.platform === "win32")("should work with custom directory name", () => {
        expect.assertions(2);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            const result = installHooks(".my-hooks");

            expect(result.isError).toBe(false);
            expect(existsSync(join(root, ".my-hooks", "_", "pre-commit"))).toBe(true);
        } finally {
            cleanup();
        }
    });
});

// ─── uninstallHooks (integration) ───────────────────────────────────

describe(uninstallHooks, () => {
    it.skipIf(process.platform === "win32")("should unset core.hooksPath and remove internal directory", () => {
        expect.assertions(5);

        const { cleanup, root } = createTemporaryGitRepo();

        try {
            // Install first
            installHooks(".vis-hooks");

            expect(existsSync(join(root, ".vis-hooks", "_"))).toBe(true);

            // Uninstall
            const result = uninstallHooks(".vis-hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toBe("");
            expect(existsSync(join(root, ".vis-hooks", "_"))).toBe(false);

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
            const result = uninstallHooks(".vis-hooks");

            expect(result.isError).toBe(false);
            expect(result.message).toContain("No custom hooks path");
        } finally {
            cleanup();
        }
    });
});

// ─── transformHookScript (unit) ─────────────────────────────────────

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

// ─── detectHuskyDirectory (unit) ────────────────────────────────────

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

// ─── detectPackageManager (unit) ────────────────────────────────────

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

// ─── cleanPackageJsonScripts (unit) ─────────────────────────────────

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
