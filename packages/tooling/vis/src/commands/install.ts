import { rmSync } from "node:fs";

import type { Command } from "@visulima/cerebro";
import { join } from "@visulima/path";

import { error as errorOutput, info } from "../output";
import { detectPm, runInstall } from "../pm-runner";
import { scanDepsForTyposquats } from "../typosquats";
import { toStringArray } from "../utils";

const install: Command = {
    alias: "i",
    description: "Install dependencies using the detected package manager",
    examples: [
        ["vis install", "Install all dependencies"],
        ["vis i --frozen-lockfile", "Install with frozen lockfile (CI mode)"],
        ["vis install --ci", "Clean install: wipe node_modules + frozen lockfile (mirrors npm ci / pnpm ci)"],
        ["vis install --prod", "Install production dependencies only"],
        ["vis install --filter app", "Install for specific workspace package"],
        ["vis install --ignore-scripts", "Install without running lifecycle scripts"],
        ["vis install --no-typosquat-check", "Skip typosquat name check"],
    ],
    execute: async ({ logger, options, visConfig, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();

        // Scan package.json deps for typosquats (unless disabled)
        if (!options.noTyposquatCheck) {
            const shouldContinue = await scanDepsForTyposquats(cwd, visConfig?.security?.typosquatAllowlist);

            if (!shouldContinue) {
                process.exitCode = 1;

                return;
            }
        }

        const pm = detectPm(cwd);
        const filters = toStringArray(options.filter);
        const ciMode = (options.ci as boolean) || false;

        // --ci mirrors `npm ci` / `pnpm ci` / `yarn install --immutable`:
        // wipe node_modules so the install fully reproduces the lockfile.
        // Works for every PM (including pnpm v10) because we do the wipe ourselves
        // and then delegate to a standard frozen-lockfile install.
        if (ciMode) {
            info("Clean install: removing node_modules...");

            try {
                rmSync(join(cwd, "node_modules"), { force: true, recursive: true });
            } catch (error: unknown) {
                errorOutput(`Failed to remove node_modules: ${error instanceof Error ? error.message : String(error)}`);
                process.exitCode = 1;

                return;
            }
        }

        const code = runInstall(
            pm,
            {
                dev: (options.dev as boolean) || false,
                filter: filters,
                force: (options.force as boolean) || false,
                frozenLockfile: ciMode || (options.frozenLockfile as boolean) || false,
                ignoreScripts: (options.ignoreScripts as boolean) || false,
                lockfileOnly: (options.lockfileOnly as boolean) || false,
                noOptional: (options.noOptional as boolean) || false,
                offline: (options.offline as boolean) || false,
                prod: (options.prod as boolean) || false,
                recursive: (options.recursive as boolean) || false,
                silent: (options.silent as boolean) || false,
                workspaceRoot: (options.workspaceRoot as boolean) || false,
            },
            cwd,
            logger,
        );

        if (code !== 0) {
            process.exitCode = code;
        }
    },
    group: "Dependencies",
    name: "install",
    options: [
        { alias: "P", defaultValue: false, description: "Skip devDependencies", name: "prod", type: Boolean },
        { alias: "D", defaultValue: false, description: "Install devDependencies only", name: "dev", type: Boolean },
        { defaultValue: false, description: "Use frozen lockfile (CI mode, maps to npm ci)", name: "frozen-lockfile", type: Boolean },
        { defaultValue: false, description: "Clean install: wipe node_modules then install with frozen lockfile", name: "ci", type: Boolean },
        { alias: "f", defaultValue: false, description: "Force reinstall all dependencies", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip lifecycle scripts", name: "ignore-scripts", type: Boolean },
        { defaultValue: false, description: "Update lockfile without installing", name: "lockfile-only", type: Boolean },
        { defaultValue: false, description: "Skip optional dependencies", name: "no-optional", type: Boolean },
        { defaultValue: false, description: "Use only cached packages", name: "offline", type: Boolean },
        { alias: "s", defaultValue: false, description: "Suppress output", name: "silent", type: Boolean },
        { alias: "r", defaultValue: false, description: "Install in all workspace packages", name: "recursive", type: Boolean },
        { alias: "w", defaultValue: false, description: "Target workspace root", name: "workspace-root", type: Boolean },
        { alias: "F", description: "Filter by workspace package name", multiple: true, name: "filter", type: String },
        { defaultValue: false, description: "Skip typosquat name check", name: "no-typosquat-check", type: Boolean },
    ],
};

export default install;
