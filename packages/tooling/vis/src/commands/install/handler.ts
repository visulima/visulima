import { rmSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { join } from "@visulima/path";

import { error as errorOutput, info, warn } from "../../output";
import type { InstallBackend } from "../../pm-runner";
import { detectLockfileDrift, detectPm, resolveInstaller, runInstall } from "../../pm-runner";
import { scanDepsForTyposquats } from "../../typosquats";
import { toStringArray } from "../../utils";
import type { InstallOptions } from "./index";

const ALLOWED_BACKENDS: ReadonlySet<InstallBackend> = new Set(["aube", "auto", "bun", "npm", "pnpm", "yarn"]);

const execute = async ({ logger, options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, InstallOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();

    // Scan package.json deps for typosquats (unless disabled)
    if (!options.noTyposquatCheck) {
        const shouldContinue = await scanDepsForTyposquats(cwd, visConfig?.security?.typosquatAllowlist);

        if (!shouldContinue) {
            process.exitCode = 1;

            return;
        }
    }

    const flagBackendRaw = options.installer;

    if (flagBackendRaw && !ALLOWED_BACKENDS.has(flagBackendRaw as InstallBackend)) {
        errorOutput(`Invalid --installer value: "${flagBackendRaw}". Expected one of: ${[...ALLOWED_BACKENDS].join(", ")}.`);
        process.exitCode = 1;

        return;
    }

    const flagBackend = flagBackendRaw as InstallBackend | undefined;
    const noAube = options.noAube || false;

    // `--no-aube` is the user's explicit escape hatch: ignore CLI flag,
    // env, and config; go straight to lockfile detection. Otherwise,
    // run the full precedence chain (flag → env → config → auto).
    let pm;

    try {
        pm = noAube
            ? detectPm(cwd)
            : resolveInstaller(cwd, { backend: flagBackend, configBackend: visConfig?.install?.backend });
    } catch (error: unknown) {
        errorOutput(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;

        return;
    }

    // One-time pre-flight: warn before aube rewrites a non-aube
    // lockfile. Surfaced as a single line so it doesn't drown out
    // the install output, but loud enough that a user committing
    // the resulting churn diff sees it before they push.
    const driftWarning = detectLockfileDrift(cwd, pm);

    if (driftWarning) {
        warn(driftWarning);
    }

    const filters = toStringArray(options.filter);
    const ciMode = options.ci || false;

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
            dev: options.dev || false,
            filter: filters,
            force: options.force || false,
            frozenLockfile: ciMode || options.frozenLockfile || false,
            ignoreScripts: options.ignoreScripts || false,
            lockfileOnly: options.lockfileOnly || false,
            noOptional: options.noOptional || false,
            offline: options.offline || false,
            prod: options.prod || false,
            recursive: options.recursive || false,
            silent: options.silent || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
    );

    if (code !== 0) {
        process.exitCode = code;
    }
};

export default execute as CommandExecute<Toolbox>;
