/**
 * Shared helper for executing package manager commands via native Rust bindings.
 */

import type { AddOptions, DlxOptions, ExecOptions, InstallOptions, OutdatedOptions, RemoveOptions, ResolvedCommand, WhyOptions } from "./native-binding";
import { loadNativeBindings } from "./native-binding";

interface PmInfo {
    name: "bun" | "npm" | "pnpm" | "yarn";
    version: string;
}

const detectPm = (cwd: string): PmInfo => {
    const detected = loadNativeBindings()!.detectPackageManager(cwd);

    return { name: detected.name as PmInfo["name"], version: detected.version || "latest" };
};

const runResolved = (resolved: ResolvedCommand, cwd: string, logger: Console): number => {
    for (const warning of resolved.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    return loadNativeBindings()!.execPmCommandInteractive(resolved.bin, resolved.args, cwd);
};

const resolveAndRun = (
    nativeCall: (native: NonNullable<ReturnType<typeof loadNativeBindings>>) => ResolvedCommand,
    cwd: string,
    logger: Console,
): number => {
    const resolved = nativeCall(loadNativeBindings()!);

    return runResolved(resolved, cwd, logger);
};

const runInstall = (pm: PmInfo, options: InstallOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveInstall(pm.name, pm.version, options), cwd, logger);

const runAdd = (pm: PmInfo, options: AddOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveAdd(pm.name, pm.version, options), cwd, logger);

const runRemove = (pm: PmInfo, options: RemoveOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveRemove(pm.name, pm.version, options), cwd, logger);

const runDedupe = (pm: PmInfo, check: boolean, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveDedupe(pm.name, pm.version, check), cwd, logger);

const runWhy = (pm: PmInfo, options: WhyOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveWhy(pm.name, pm.version, options), cwd, logger);

const runOutdated = (pm: PmInfo, options: OutdatedOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveOutdated(pm.name, pm.version, options), cwd, logger);

const runLink = (pm: PmInfo, target: string | null, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveLink(pm.name, target), cwd, logger);

const runUnlink = (pm: PmInfo, packages: string[], recursive: boolean, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveUnlink(pm.name, pm.version, packages, recursive), cwd, logger);

const runDlx = (pm: PmInfo, options: DlxOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveDlx(pm.name, pm.version, options), cwd, logger);

const runExec = (pm: PmInfo, options: ExecOptions, cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolveExec(pm.name, pm.version, options), cwd, logger);

const runPmSubcommand = (pm: PmInfo, subcommand: string, args: string[], cwd: string, logger: Console): number =>
    resolveAndRun((native) => native.resolvePmCommand(pm.name, pm.version, subcommand, args), cwd, logger);

export type { PmInfo };
export { detectPm, runAdd, runDedupe, runDlx, runExec, runInstall, runLink, runOutdated, runPmSubcommand, runRemove, runUnlink, runWhy };
