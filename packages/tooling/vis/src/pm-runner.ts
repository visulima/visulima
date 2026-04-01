/**
 * Shared helper for executing package manager commands.
 * Tries native Rust bindings first, falls back to direct spawnSync.
 */

import { spawnSync } from "node:child_process";

import { findPackageManagerSync, getPackageManagerVersion } from "@visulima/package";

import type { AddOptions, DlxOptions, ExecOptions, InstallOptions, OutdatedOptions, RemoveOptions, ResolvedCommand, WhyOptions } from "./native-binding";
import { loadNativeBindings } from "./native-binding";

interface PmInfo {
    name: "bun" | "npm" | "pnpm" | "yarn";
    version: string;
}

const detectPm = (cwd: string): PmInfo => {
    const native = loadNativeBindings();

    if (native) {
        try {
            const detected = native.detectPackageManager(cwd);

            return { name: detected.name as PmInfo["name"], version: detected.version || "latest" };
        } catch {
            // Fall through to JS fallback
        }
    }

    // Fallback to @visulima/package
    try {
        const { packageManager } = findPackageManagerSync(cwd);

        return {
            name: packageManager as PmInfo["name"],
            version: getPackageManagerVersion(packageManager) ?? "latest",
        };
    } catch {
        return { name: "npm", version: "latest" };
    }
};

const runResolved = (resolved: ResolvedCommand, cwd: string, logger: Console): number => {
    for (const warning of resolved.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    const native = loadNativeBindings();

    if (native) {
        return native.execPmCommandInteractive(resolved.bin, resolved.args, cwd);
    }

    // Fallback: spawnSync with inherited stdio
    const result = spawnSync(resolved.bin, resolved.args, {
        cwd,
        stdio: "inherit",
    });

    return result.status ?? 1;
};

// ── High-level resolve+run helpers (native with TS fallback) ─────────

const resolveAndRun = (
    _resolverName: string,
    nativeCall: (native: NonNullable<ReturnType<typeof loadNativeBindings>>) => ResolvedCommand,
    fallbackBin: string,
    fallbackArgs: string[],
    cwd: string,
    logger: Console,
): number => {
    const native = loadNativeBindings();

    if (native) {
        const resolved = nativeCall(native);

        return runResolved(resolved, cwd, logger);
    }

    // Fallback: run directly with spawnSync
    const result = spawnSync(fallbackBin, fallbackArgs, { cwd, stdio: "inherit" });

    return result.status ?? 1;
};

const runInstall = (pm: PmInfo, opts: InstallOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "install",
        (native) => native.resolveInstall(pm.name, pm.version, opts),
        pm.name,
        ["install"],
        cwd,
        logger,
    );

const runAdd = (pm: PmInfo, opts: AddOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "add",
        (native) => native.resolveAdd(pm.name, pm.version, opts),
        pm.name,
        [pm.name === "npm" ? "install" : "add", ...opts.packages],
        cwd,
        logger,
    );

const runRemove = (pm: PmInfo, opts: RemoveOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "remove",
        (native) => native.resolveRemove(pm.name, pm.version, opts),
        pm.name,
        [pm.name === "npm" ? "uninstall" : "remove", ...opts.packages],
        cwd,
        logger,
    );

const runDedupe = (pm: PmInfo, check: boolean, cwd: string, logger: Console): number =>
    resolveAndRun(
        "dedupe",
        (native) => native.resolveDedupe(pm.name, pm.version, check),
        pm.name,
        ["dedupe", ...(check ? ["--check"] : [])],
        cwd,
        logger,
    );

const runWhy = (pm: PmInfo, opts: WhyOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "why",
        (native) => native.resolveWhy(pm.name, pm.version, opts),
        pm.name,
        [pm.name === "npm" ? "explain" : "why", ...opts.packages],
        cwd,
        logger,
    );

const runOutdated = (pm: PmInfo, opts: OutdatedOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "outdated",
        (native) => native.resolveOutdated(pm.name, pm.version, opts),
        pm.name,
        ["outdated", ...opts.packages],
        cwd,
        logger,
    );

const runLink = (pm: PmInfo, target: string | null, cwd: string, logger: Console): number =>
    resolveAndRun(
        "link",
        (native) => native.resolveLink(pm.name, target),
        pm.name,
        ["link", ...(target ? [target] : [])],
        cwd,
        logger,
    );

const runUnlink = (pm: PmInfo, packages: string[], recursive: boolean, cwd: string, logger: Console): number =>
    resolveAndRun(
        "unlink",
        (native) => native.resolveUnlink(pm.name, pm.version, packages, recursive),
        pm.name,
        ["unlink", ...packages],
        cwd,
        logger,
    );

const runDlx = (pm: PmInfo, opts: DlxOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "dlx",
        (native) => native.resolveDlx(pm.name, pm.version, opts),
        pm.name === "npm" ? "npx" : pm.name === "bun" ? "bunx" : pm.name,
        [pm.name === "pnpm" ? "dlx" : "", opts.package, ...opts.args].filter(Boolean),
        cwd,
        logger,
    );

const runExec = (pm: PmInfo, opts: ExecOptions, cwd: string, logger: Console): number =>
    resolveAndRun(
        "exec",
        (native) => native.resolveExec(pm.name, pm.version, opts),
        pm.name,
        ["exec", opts.command, ...opts.args],
        cwd,
        logger,
    );

const runPmSubcommand = (pm: PmInfo, subcommand: string, args: string[], cwd: string, logger: Console): number =>
    resolveAndRun(
        "pm",
        (native) => native.resolvePmCommand(pm.name, pm.version, subcommand, args),
        pm.name,
        [subcommand, ...args],
        cwd,
        logger,
    );

export type { PmInfo };
export {
    detectPm,
    runAdd,
    runDedupe,
    runDlx,
    runExec,
    runInstall,
    runLink,
    runOutdated,
    runPmSubcommand,
    runRemove,
    runUnlink,
    runWhy,
};
