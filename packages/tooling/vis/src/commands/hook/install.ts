import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { ensureDirSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { InstallResult } from "./constants";
import { DEFAULT_HOOKS_DIRECTORY, HOOKS } from "./constants";

const TRAILING_SLASH_RE = /\/$/;

/**
 * Builds a nested dirname expression for the shell script.
 *
 * Example: depth 3 produces `dirname "$(dirname "$(dirname "$0"))"`.
 */
const nestedDirname = (depth: number): string => {
    let expression = '"$0"';

    for (let index = 0; index < depth; index += 1) {
        expression = `"$(dirname ${expression})"`;
    }

    return expression;
};

/**
 * Generates the shell script that dispatches to user-defined hooks.
 */
const hookScript = (directory: string): string => {
    const segments = directory.split("/").filter((s) => s !== "" && s !== ".").length;
    const depth = segments + 2;
    const rootExpression = nestedDirname(depth);

    return `#!/usr/bin/env sh
{ [ "$VIS_GIT_HOOKS" = "2" ]; } && set -x
n=$(basename "$0")
s=$(dirname "$(dirname "$0")")/$n

[ ! -f "$s" ] && exit 0

{ [ "\${VIS_GIT_HOOKS-}" = "0" ]; } && exit 0

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
        return { isError: true, message: '".." is not allowed in hooks directory path' };
    }

    const prefixResult = spawnSync("git", ["rev-parse", "--show-prefix"]);

    if (prefixResult.status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (prefixResult.status !== 0) {
        return { isError: false, message: ".git directory not found (not a git repository)" };
    }

    const internal = (path = ""): string => join(directory, "_", path);
    const relative = prefixResult.stdout.toString().trim().replace(TRAILING_SLASH_RE, "");
    const target = relative ? `${relative}/${directory}/_` : `${directory}/_`;

    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"]);
    const existingHooksPath = checkResult.status === 0 ? checkResult.stdout?.toString().trim() : "";

    if (existingHooksPath && existingHooksPath !== target) {
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

    ensureDirSync(internal());
    writeFileSync(internal(".gitignore"), "*");
    writeFileSync(internal("h"), hookScript(directory), { mode: 0o755 });

    for (const hook of HOOKS) {
        writeFileSync(internal(hook), `#!/usr/bin/env sh\n. "$(dirname "$0")/h"`, { mode: 0o755 });
    }

    return { isError: false, message: "" };
};

export { hookScript, installHooks };
