import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { InstallResult } from "./constants";
import { DEFAULT_HOOKS_DIRECTORY } from "./constants";

const uninstallHooks = (directory: string = DEFAULT_HOOKS_DIRECTORY): InstallResult => {
    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"]);

    if (checkResult.status !== 0) {
        return { isError: false, message: "No custom hooks path configured" };
    }

    const { status, stderr } = spawnSync("git", ["config", "--local", "--unset", "core.hooksPath"]);

    if (status === undefined || status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (status && status !== 5) {
        return { isError: true, message: String(stderr) };
    }

    const internalDirectory = join(directory, "_");

    if (isAccessibleSync(internalDirectory)) {
        rmSync(internalDirectory, { force: true, recursive: true });
    }

    return { isError: false, message: "" };
};

export { uninstallHooks };
