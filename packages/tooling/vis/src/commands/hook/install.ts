import { spawnSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { ensureDirSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { loadHookConfig } from "./config";
import type { InstallResult } from "./constants";
import { DEFAULT_HOOKS_DIRECTORY, HOOKS, LEGACY_HOOKS_DIRECTORY } from "./constants";

const TRAILING_SLASH_RE = /\/$/;

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

const installHooks = (directory: string = DEFAULT_HOOKS_DIRECTORY): InstallResult => {
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

    const internal = (path = ""): string => join(directory, "_", path);
    const relative = prefixResult.stdout.toString().trim().replace(TRAILING_SLASH_RE, "");
    const target = relative ? `${relative}/${directory}/_` : `${directory}/_`;
    // The pre-1.0 default lived at `.vis-hooks/_`; treat a config still pointing
    // there as ours so the migration re-points it instead of bailing out.
    const legacyTarget = relative ? `${relative}/${LEGACY_HOOKS_DIRECTORY}/_` : `${LEGACY_HOOKS_DIRECTORY}/_`;

    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"]);
    const existingHooksPath = checkResult.status === 0 ? checkResult.stdout?.toString().trim() : "";

    if (existingHooksPath && existingHooksPath !== target && existingHooksPath !== legacyTarget) {
        return {
            isError: false,
            message: `core.hooksPath is already set to "${existingHooksPath}", skipping`,
        };
    }

    const { status, stderr } = spawnSync("git", ["config", "core.hooksPath", target]);

    if (status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (status) {
        return { isError: true, message: String(stderr) };
    }

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

    ensureDirSync(internal());
    writeFileSync(internal(".gitignore"), "*");
    writeFileSync(internal("h"), hookScript(directory, { skipInCI }), { mode: 0o755 });

    for (const hook of HOOKS) {
        writeFileSync(internal(hook), `#!/usr/bin/env sh\n. "$(dirname "$0")/h"`, { mode: 0o755 });
    }

    return { isError: false, message: migrationNote ?? "" };
};

export { hookScript, installHooks };
