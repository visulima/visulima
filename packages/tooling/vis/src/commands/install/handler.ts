import { rmSync } from "node:fs";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";

import { pail } from "../../io/logger";
import type { InstallBackend } from "../../pm/pm-runner";
import { detectLockfileDrift, detectPm, resolveInstaller, runInstallCaptured } from "../../pm/pm-runner";
import { scanDepsForTyposquats } from "../../security/typosquats";
import { hasPeerDependencyWarnings, PEER_HINT } from "../../util/peer-warnings";
import { toStringArray } from "../../util/utils";
import type { InstallOptions } from "./index";

const LOCKFILE_NAMES: ReadonlyArray<string> = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json", "npm-shrinkwrap.json", "bun.lock", "bun.lockb"];

/**
 * Walk up from `start` checking for any known PM lockfile. We only need
 * to know whether a lockfile exists somewhere on the workspace path —
 * the specific PM is resolved separately.
 */
const hasLockfile = (start: string): boolean => {
    let dir = start;

    while (true) {
        for (const name of LOCKFILE_NAMES) {
            if (isAccessibleSync(join(dir, name))) {
                return true;
            }
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return false;
        }

        dir = parent;
    }
};

const ALLOWED_BACKENDS: ReadonlySet<InstallBackend> = new Set(["aube", "auto", "bun", "npm", "pnpm", "yarn"]);

const execute = async (toolbox: Toolbox<Console, InstallOptions>): Promise<void> => {
    const { argument, logger, options, visConfig, workspaceRoot: wsRoot } = toolbox;
    const cwd = wsRoot ?? process.cwd();

    // npm-style passthrough: `vis install <pkg>` (or aliased `npm install <pkg>`)
    // delegates to the `vis add` pipeline, which runs typosquats + marshalls +
    // Socket.dev and edits package.json instead of running a bare install.
    if (argument && argument.length > 0) {
        const opts = options as Record<string, unknown>;
        const { default: addExecute } = await import("../add/handler");

        // Cerebro normalizes `--no-foo` into camelCase `foo: false` at parse time.
        // The add handler reads `marshallCheck`/`socketCheck`/`typosquatCheck`
        // and treats `=== false` as "user opted out". Pass `false` only when
        // the user actually disabled the check; otherwise leave it undefined
        // so the default-enabled path runs.
        const marshallCheck = opts.marshallCheck === false || opts["no-marshall-check"] === true ? false : undefined;
        const socketCheck = opts.socketCheck === false || opts["no-socket-check"] === true ? false : undefined;
        const typosquatCheck = opts.typosquatCheck === false || opts["no-typosquat-check"] === true ? false : undefined;
        const runScripts = opts.runScripts === true || opts["run-scripts"] === true;
        const workspaceRoot = opts.workspaceRoot === true || opts["workspace-root"] === true;
        const saveOptional = opts.saveOptional === true || opts["save-optional"] === true;
        const saveDev = options.dev === true;

        const addOptions: Record<string, unknown> = {
            autoInstallPeers: false,
            exact: opts.exact === true,
            filter: options.filter,
            global: false,
            marshallCheck,
            runScripts,
            saveDev,
            saveOptional,
            savePeer: false,
            socketCheck,
            to: undefined,
            typosquatCheck,
            workspace: false,
            workspaceRoot,
        };

        await addExecute({ ...toolbox, argument, options: addOptions });

        return;
    }

    // Scan package.json deps for typosquats (unless disabled)
    if ((options as Record<string, unknown>).typosquatCheck !== false) {
        const shouldContinue = await scanDepsForTyposquats(cwd, visConfig?.security?.typosquatAllowlist);

        if (!shouldContinue) {
            process.exitCode = 1;

            return;
        }
    }

    const flagBackendRaw = options.installer;

    if (flagBackendRaw && !ALLOWED_BACKENDS.has(flagBackendRaw as InstallBackend)) {
        pail.error(`Invalid --installer value: "${flagBackendRaw}". Expected one of: ${[...ALLOWED_BACKENDS].join(", ")}.`);
        process.exitCode = 1;

        return;
    }

    const flagBackend = flagBackendRaw as InstallBackend | undefined;
    const noAube = (options as Record<string, unknown>).aube === false;

    // `--no-aube` is the user's explicit escape hatch: ignore CLI flag,
    // env, and config; go straight to lockfile detection. Otherwise,
    // run the full precedence chain (flag → env → config → auto).
    let pm;

    try {
        pm = noAube
            ? detectPm(cwd)
            : resolveInstaller(cwd, { backend: flagBackend, configBackend: visConfig?.install?.backend, configCorepack: visConfig?.install?.corepack });
    } catch (error: unknown) {
        pail.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;

        return;
    }

    // One-time pre-flight: warn before aube rewrites a non-aube
    // lockfile. Surfaced as a single line so it doesn't drown out
    // the install output, but loud enough that a user committing
    // the resulting churn diff sees it before they push.
    const driftWarning = detectLockfileDrift(cwd, pm);

    if (driftWarning) {
        pail.warn(driftWarning);
    }

    const filters = toStringArray(options.filter);
    const ciMode = options.ci || false;

    // Secure-by-default lockfile semantics: when a lockfile is present
    // and the user hasn't asked for a mutation (force, lockfile-only) or
    // an explicit opt-out (--no-frozen-lockfile), default to frozen-lockfile
    // so `vis install` mirrors `npm ci` semantics rather than `npm install`'s
    // silent lockfile rewrites. Greenfield workspaces (no lockfile) skip
    // the default — there's nothing to freeze yet.
    const explicitFrozen = options.frozenLockfile || ciMode;
    const optedOutOfFrozen = options.frozenLockfile === false || options.force || options.lockfileOnly;
    const lockfilePresent = hasLockfile(cwd);
    const shouldFreeze = explicitFrozen || (!optedOutOfFrozen && lockfilePresent);

    if (!explicitFrozen && shouldFreeze && !options.silent) {
        pail.info("Defaulting to frozen lockfile (pass --no-frozen-lockfile to allow lockfile updates).");
    }

    // --ci mirrors `npm ci` / `pnpm ci` / `yarn install --immutable`:
    // wipe node_modules so the install fully reproduces the lockfile.
    // Works for every PM (including pnpm v10) because we do the wipe ourselves
    // and then delegate to a standard frozen-lockfile install.
    if (ciMode) {
        pail.info("Clean install: removing node_modules...");

        try {
            rmSync(join(cwd, "node_modules"), { force: true, recursive: true });
        } catch (error: unknown) {
            pail.error(`Failed to remove node_modules: ${error instanceof Error ? error.message : String(error)}`);
            process.exitCode = 1;

            return;
        }
    }

    const { code, output } = await runInstallCaptured(
        pm,
        {
            dev: options.dev || false,
            filter: filters,
            force: options.force || false,
            frozenLockfile: shouldFreeze,
            // Block-by-default lifecycle scripts (mirrors pnpm v10).
            // Allowlisted packages from `security.policies.installScripts.allow`
            // are executed post-install by the `security-enforcement` plugin's
            // afterCommand hook (`runApprovedScripts`). The escape hatch
            // is `--run-scripts`, which restores the PM's native behavior.
            ignoreScripts: !options.runScripts,
            lockfileOnly: options.lockfileOnly || false,
            noOptional: (options as Record<string, unknown>).optional === false,
            offline: options.offline || false,
            prod: options.prod || false,
            recursive: options.recursive || false,
            silent: options.silent || false,
            workspaceRoot: options.workspaceRoot || false,
        },
        cwd,
        logger,
        { ciMode, preferOffline: options.preferOffline || false },
    );

    if (code !== 0) {
        process.exitCode = code;
    }

    // Surfaced after the PM finishes streaming its own report so the hint
    // lands underneath the warning tree the user just read — and only when
    // we actually saw the warning text, to avoid noisy false positives on
    // green installs.
    if (code === 0 && !options.silent && hasPeerDependencyWarnings(output)) {
        pail.info(PEER_HINT);
    }
};

export default execute as CommandExecute<Toolbox>;
