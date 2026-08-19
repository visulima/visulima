import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { ensureDirSync } from "@visulima/fs";
import { isAbsolute, join } from "@visulima/path";

import { loadHookConfig } from "./config";
import type { InstallResult } from "./constants";
import { DEFAULT_HOOKS_DIRECTORY, HOOKS, LEGACY_HOOKS_DIRECTORY } from "./constants";

const TRAILING_SLASH_RE = /\/$/;
const WORKTREE_LINE_PREFIX = "worktree ";

/**
 * One-time move of the pre-1.0 `.vis-hooks` directory to its new home under
 * `.vis/hooks`. Returns a human-readable note when a move happened so the
 * caller can surface it. No-op when there's nothing to migrate or the
 * destination already exists. `core.hooksPath` is rewritten by the caller
 * right afterwards and the `_` internals are regenerated, so only the
 * user-authored stage scripts + `config.json` need to come along.
 */
const migrateLegacyHooksDirectory = (directory: string): string | undefined => {
    if (directory === LEGACY_HOOKS_DIRECTORY || !existsSync(LEGACY_HOOKS_DIRECTORY) || existsSync(directory)) {
        return undefined;
    }

    const parent = dirname(directory);

    if (parent && parent !== ".") {
        ensureDirSync(parent);
    }

    renameSync(LEGACY_HOOKS_DIRECTORY, directory);

    return `migrated ${LEGACY_HOOKS_DIRECTORY} → ${directory}`;
};

/**
 * Builds a nested dirname expression for the shell script.
 *
 * Example: depth 3 produces `dirname "$(dirname "$(dirname "$0"))"`.
 */
const nestedDirname = (depth: number): string => {
    let expression = "\"$0\"";

    for (let index = 0; index < depth; index += 1) {
        expression = `"$(dirname ${expression})"`;
    }

    return expression;
};

/**
 * Generates the shell script that dispatches to user-defined hooks.
 *
 * `options.skipInCI` (from `config.json`) bakes a CI kill-switch into the
 * dispatcher: under any non-empty CI environment variable, every hook exits
 * 0 before its body runs. It sits after the `VIS_GIT_HOOKS=0` guard (so 0
 * still disables everything) and is bypassed when `VIS_GIT_HOOKS` equals 1
 * (so a single CI job can force hooks back on). Mirrors where husky places
 * its own dispatcher skip-guard, but is driven by config and regenerated on
 * `vis hook install` rather than hand-written per repo.
 */
const hookScript = (directory: string, options: { skipInCI?: boolean } = {}): string => {
    const segments = directory.split("/").filter((s) => s !== "" && s !== ".").length;
    const depth = segments + 2;
    const rootExpression = nestedDirname(depth);

    // Built as a plain string (not part of the template literal below) so the
    // `${CI-}` / `${VIS_GIT_HOOKS-}` shell expansions reach the output verbatim.
    const ciGuard = options.skipInCI ? "{ [ -n \"${CI-}\" ] && [ \"${VIS_GIT_HOOKS-}\" != \"1\" ]; } && exit 0\n" : "";

    return `#!/usr/bin/env sh
{ [ "$VIS_GIT_HOOKS" = "2" ]; } && set -x
n=$(basename "$0")
s=$(dirname "$(dirname "$0")")/$n

[ ! -f "$s" ] && exit 0

{ [ "\${VIS_GIT_HOOKS-}" = "0" ]; } && exit 0
${ciGuard}
d=${rootExpression}
export PATH="$d/node_modules/.bin:$PATH"
sh -e "$s" "$@"
c=$?

[ $c != 0 ] && echo "vis - $n script failed (code $c)"
[ $c = 127 ] && echo "vis - command not found in PATH=$PATH"
exit $c`;
};

/** Writes the generated `_` dispatcher into one checkout. */
const writeDispatcher = (internalDirectory: string, directory: string, skipInCI: boolean): void => {
    ensureDirSync(internalDirectory);
    writeFileSync(join(internalDirectory, ".gitignore"), "*");
    writeFileSync(join(internalDirectory, "h"), hookScript(directory, { skipInCI }), { mode: 0o755 });

    for (const hook of HOOKS) {
        writeFileSync(join(internalDirectory, hook), `#!/usr/bin/env sh\n. "$(dirname "$0")/h"`, { mode: 0o755 });
    }
};

/**
 * Every working checkout attached to this repository — the main one plus any
 * linked worktree.
 *
 * Bare entries have no files to dispatch from, and `prunable` entries name a
 * directory the user already deleted: writing there would resurrect the path
 * on disk (and, when the worktree lived on removable media, create a tree
 * under the mountpoint that keeps the volume from mounting cleanly). Both are
 * skipped, as is any checkout that is not currently present.
 *
 * Falls back to `cwd` when `git worktree list` is unavailable.
 */
const checkoutRoots = (cwd?: string): string[] => {
    const result = spawnSync("git", ["worktree", "list", "--porcelain"], { cwd, encoding: "utf8" });
    const roots: string[] = [];

    if (result.status === 0) {
        let current: string | undefined;

        for (const line of result.stdout.split("\n")) {
            if (line.startsWith(WORKTREE_LINE_PREFIX)) {
                current = line.slice(WORKTREE_LINE_PREFIX.length).trim() || undefined;
            } else if (line === "bare" || line === "locked" || line.startsWith("locked ") || line.startsWith("prunable")) {
                current = undefined;
            } else if (line === "" && current) {
                roots.push(current);
                current = undefined;
            }
        }

        if (current) {
            roots.push(current);
        }
    }

    const present = roots.filter((root) => existsSync(root));

    return present.length > 0 ? present : [cwd ?? process.cwd()];
};

/**
 * Where the `_` dispatcher belongs in every checkout of this repository.
 *
 * `core.hooksPath` is written with `git config --local`, which lands in the
 * shared `$GIT_COMMON_DIR/config`, but its value is relative so git resolves
 * it inside whichever checkout the commit happens in. The dispatcher is
 * generated and gitignored, so a checkout without one leaves git pointing at
 * a directory that does not exist there — which git treats as "no hooks",
 * silently and with exit 0.
 *
 * `hooksTarget` is the configured `core.hooksPath` value, itself relative to
 * a checkout root, so joining it onto each root is exactly how git resolves
 * it there. Install and validate share this so they cannot disagree about
 * where a dispatcher should be — a disagreement reads as a missing dispatcher
 * in whichever of them is wrong.
 */
const dispatcherDirectories = (hooksTarget: string, cwd?: string): string[] => checkoutRoots(cwd).map((root) => join(root, hooksTarget));

const resolveHooksPath = (hooksPath: string, root: string): string => (isAbsolute(hooksPath) ? hooksPath : join(root, hooksPath));

/**
 * Does this `core.hooksPath` value name `directory`, whatever checkout prefix
 * it carries? `git rev-parse --show-prefix` depends on the directory install
 * was invoked from, so the same repo reports `packages/app/.vis/hooks/_` from
 * one cwd and `.vis/hooks/_` from another.
 */
const namesHooksDirectory = (value: string, directory: string): boolean => value === `${directory}/_` || value.endsWith(`/${directory}/_`);

/** A dispatcher vis generated — `h` is our script, whatever directory it sits in. */
const isVisDispatcher = (hooksPath: string, root: string): boolean => {
    try {
        return readFileSync(join(resolveHooksPath(hooksPath, root), "h"), "utf8").includes("VIS_GIT_HOOKS");
    } catch {
        return false;
    }
};

/**
 * What is actually at someone else's `core.hooksPath`?
 *
 * `populated` is the only state where yielding is graceful. `empty` is a real
 * directory holding nothing git would run — `.git/hooks` with just its
 * `*.sample` files is the common one — so git runs no hooks at all and
 * reporting success is how a repo ends up with no gate and nobody notices.
 * `missing` is neither: `core.hooksPath=/dev/null` is the git-native way to
 * turn hooks off for a clone, and an absent directory may belong to a tool
 * whose files simply are not checked out yet.
 */
const probeHooksPath = (hooksPath: string, root: string): "empty" | "missing" | "populated" => {
    let entries: string[];

    try {
        entries = readdirSync(resolveHooksPath(hooksPath, root));
    } catch {
        return "missing";
    }

    return entries.some((entry) => !entry.startsWith(".") && !entry.endsWith(".sample")) ? "populated" : "empty";
};

/**
 * Picks the `core.hooksPath` install should end up with, or refuses to touch
 * it. Returns `{ target }` to proceed, or `{ yielded }` to stop.
 */
const arbitrateHooksPath = (directory: string, target: string, topLevel: string, force: boolean): { target: string } | { yielded: InstallResult } => {
    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"]);
    const existing = checkResult.status === 0 ? (checkResult.stdout?.toString().trim() ?? "") : "";

    if (!existing || force) {
        return { target };
    }

    // Already ours, just anchored at a different checkout prefix. Keep the
    // configured value: rewriting it would move the whole repo's hooks path as
    // a side effect of which directory install happened to run from, and this
    // is the ordinary state inside a fresh worktree that needs a dispatcher.
    if (namesHooksDirectory(existing, directory)) {
        return { target: existing };
    }

    // The pre-1.0 default lived at `.vis-hooks/_`, and a dispatcher we
    // generated under a different `--hooks-dir` is still ours: re-point both.
    if (namesHooksDirectory(existing, LEGACY_HOOKS_DIRECTORY) || isVisDispatcher(existing, topLevel)) {
        return { target };
    }

    if (probeHooksPath(existing, topLevel) === "empty") {
        return {
            yielded: {
                isError: true,
                message:
                    `core.hooksPath is set to "${existing}", which holds no hooks — git is currently running none. `
                    + "Re-run with `vis hook install --force` to take it over, unset it with `git config --local --unset core.hooksPath`, "
                    + "or set VIS_GIT_HOOKS=0 to skip installing hooks entirely.",
            },
        };
    }

    return {
        yielded: {
            isError: false,
            isWarning: true,
            message: `core.hooksPath is already set to "${existing}" by another tool, skipping. Re-run with \`vis hook install --force\` to take it over.`,
        },
    };
};

const installHooks = (directory: string = DEFAULT_HOOKS_DIRECTORY, options: { force?: boolean } = {}): InstallResult => {
    if (process.env["VIS_GIT_HOOKS"] === "0") {
        return { isError: false, message: "skip install (git hooks disabled via VIS_GIT_HOOKS=0)" };
    }

    if (directory.includes("..")) {
        return { isError: true, message: "\"..\" is not allowed in hooks directory path" };
    }

    const prefixResult = spawnSync("git", ["rev-parse", "--show-prefix"]);

    if (prefixResult.status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (prefixResult.status !== 0) {
        return { isError: false, message: ".git directory not found (not a git repository)" };
    }

    const migrationNote = migrateLegacyHooksDirectory(directory);

    const relative = prefixResult.stdout.toString().trim().replace(TRAILING_SLASH_RE, "");
    const topLevelResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    const topLevel = topLevelResult.status === 0 && topLevelResult.stdout.trim() ? topLevelResult.stdout.trim() : process.cwd();

    const arbitration = arbitrateHooksPath(directory, relative ? `${relative}/${directory}/_` : `${directory}/_`, topLevel, Boolean(options.force));

    if ("yielded" in arbitration) {
        return arbitration.yielded;
    }

    const { target } = arbitration;

    // Read `skipInCI` from config.json (created by migrate / hand-authored)
    // so the dispatcher we write below carries the CI kill-switch. A
    // malformed config shouldn't block install — `vis hook run` / `vis hook
    // validate` surface that error loudly — so fall back to no guard.
    const skipInCI = ((): boolean => {
        try {
            return loadHookConfig(process.cwd(), directory)?.skipInCI ?? false;
        } catch {
            return false;
        }
    })();

    // This checkout's dispatcher has to work — without it there is nothing for
    // `core.hooksPath` to resolve to here — so write it before touching the
    // config and fail outright if it cannot be written. Otherwise a partial
    // install leaves the config pointing at a directory that does not exist,
    // which is exactly the silent no-hooks state being fixed.
    const currentDispatcher = join(topLevel, target);

    try {
        writeDispatcher(currentDispatcher, directory, skipInCI);
    } catch (error) {
        return { isError: true, message: `failed to write ${currentDispatcher}: ${error instanceof Error ? error.message : String(error)}` };
    }

    // Every other checkout is best-effort: one unreachable worktree (ejected
    // volume, another user's checkout) must not abort an install that already
    // succeeded where it was run.
    const failures: string[] = [];
    let alsoWritten = 0;

    for (const dispatcher of dispatcherDirectories(target, topLevel)) {
        if (dispatcher === currentDispatcher) {
            continue;
        }

        try {
            writeDispatcher(dispatcher, directory, skipInCI);
            alsoWritten += 1;
        } catch (error) {
            failures.push(`${dispatcher} (${error instanceof Error ? error.message : String(error)})`);
        }
    }

    const { status, stderr } = spawnSync("git", ["config", "core.hooksPath", target]);

    if (status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (status) {
        return { isError: true, message: String(stderr) };
    }

    const notes = [migrationNote, alsoWritten > 0 ? `installed dispatchers in ${alsoWritten} linked worktree(s)` : undefined].filter(Boolean);

    if (failures.length > 0) {
        return {
            installed: true,
            isError: false,
            isWarning: true,
            message: `could not install hooks in ${failures.length} linked worktree(s) — they will run no hooks until \`vis hook install\` succeeds there: ${failures.join(", ")}`,
        };
    }

    return { installed: true, isError: false, message: notes.join("; ") };
};

export { dispatcherDirectories, hookScript, installHooks };
