import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";

import type { InstallResult } from "./constants";
import { DEFAULT_HOOKS_DIRECTORY } from "./constants";
import { dispatcherDirectories } from "./install";

const uninstallHooks = (directory: string = DEFAULT_HOOKS_DIRECTORY): InstallResult => {
    const checkResult = spawnSync("git", ["config", "--local", "core.hooksPath"], { encoding: "utf8" });

    if (checkResult.status !== 0) {
        return { isError: false, message: "No custom hooks path configured" };
    }

    // Read the configured value before unsetting it: install anchors it at
    // whichever checkout prefix it ran from, and it is what tells us where the
    // dispatchers actually live in each worktree.
    const target = checkResult.stdout.trim() || `${directory}/_`;
    const dispatchers = dispatcherDirectories(target);

    const { status, stderr } = spawnSync("git", ["config", "--local", "--unset", "core.hooksPath"]);

    if (status === null) {
        return { isError: true, message: "git command not found" };
    }

    if (status && status !== 5) {
        return { isError: true, message: String(stderr) };
    }

    // Install writes a dispatcher into every checkout, so uninstall clears
    // every checkout; otherwise each linked worktree keeps an orphan copy.
    const failures: string[] = [];

    for (const dispatcher of dispatchers) {
        if (!isAccessibleSync(dispatcher)) {
            continue;
        }

        try {
            rmSync(dispatcher, { force: true, recursive: true });
        } catch (error) {
            failures.push(`${dispatcher} (${error instanceof Error ? error.message : String(error)})`);
        }
    }

    if (failures.length > 0) {
        return { isError: false, isWarning: true, message: `could not remove ${failures.length} dispatcher director(ies): ${failures.join(", ")}` };
    }

    return { isError: false, message: "" };
};

export { uninstallHooks };
