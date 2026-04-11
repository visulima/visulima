/**
 * Shared helper for executing package manager commands via native Rust bindings.
 * Falls back to JS-based detection when native bindings are unavailable.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse as parsePath } from "node:path";

import type { AddOptions, DlxOptions, ExecOptions, InstallOptions, OutdatedOptions, RemoveOptions, ResolvedCommand, WhyOptions } from "./native-binding";
import { loadNativeBindings } from "./native-binding";

interface PmInfo {
    name: "bun" | "npm" | "pnpm" | "yarn";
    version: string;
}

const requireNative = (): NonNullable<ReturnType<typeof loadNativeBindings>> => {
    const native = loadNativeBindings();

    if (!native) {
        throw new Error("Native bindings for package manager operations failed to load. Ensure the correct platform binary is installed.");
    }

    return native;
};

/**
 * Reads the packageManager version from package.json if it matches the given PM name.
 */
const readPackageManagerVersion = (cwd: string, pmName: string): string | undefined => {
    try {
        const pkgPath = join(cwd, "package.json");

        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: string };

            if (pkg.packageManager?.startsWith(`${pmName}@`)) {
                return pkg.packageManager.slice(pmName.length + 1);
            }
        }
    } catch {
        // ignore
    }

    return undefined;
};

/**
 * Checks if a directory contains lockfiles or packageManager config for any PM.
 */
const detectPmInDir = (dir: string): PmInfo | undefined => {
    if (existsSync(join(dir, "pnpm-lock.yaml")) || existsSync(join(dir, "pnpm-workspace.yaml"))) {
        return { name: "pnpm", version: readPackageManagerVersion(dir, "pnpm") ?? "latest" };
    }

    if (existsSync(join(dir, "yarn.lock"))) {
        return { name: "yarn", version: readPackageManagerVersion(dir, "yarn") ?? "latest" };
    }

    if (existsSync(join(dir, "bun.lock")) || existsSync(join(dir, "bun.lockb"))) {
        return { name: "bun", version: readPackageManagerVersion(dir, "bun") ?? "latest" };
    }

    if (existsSync(join(dir, "package-lock.json")) || existsSync(join(dir, "npm-shrinkwrap.json"))) {
        return { name: "npm", version: readPackageManagerVersion(dir, "npm") ?? "latest" };
    }

    // Try packageManager field in package.json
    try {
        const pkgPath = join(dir, "package.json");

        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { packageManager?: string };

            if (pkg.packageManager) {
                const match = /^(pnpm|yarn|npm|bun)@(.+)$/.exec(pkg.packageManager);

                if (match) {
                    return { name: match[1] as PmInfo["name"], version: match[2] as string };
                }
            }
        }
    } catch {
        // ignore
    }

    return undefined;
};

/**
 * JS fallback for PM detection when native bindings are unavailable.
 * Walks up from cwd to find lockfiles or packageManager fields.
 */
const detectPmFallback = (cwd: string): PmInfo => {
    let dir = cwd;

    while (true) {
        const result = detectPmInDir(dir);

        if (result) {
            return result;
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            break;
        }

        dir = parent;
    }

    throw new Error(`Could not detect package manager in ${cwd}. No lockfile or packageManager field found.`);
};

const detectPm = (cwd: string): PmInfo => {
    if (!existsSync(cwd)) {
        throw new Error(`Could not detect package manager in ${cwd}. Directory does not exist.`);
    }

    try {
        const detected = requireNative().detectPackageManager(cwd);

        return { name: detected.name as PmInfo["name"], version: detected.version || "latest" };
    } catch {
        // Native bindings unavailable, use JS fallback
        return detectPmFallback(cwd);
    }
};

const runResolved = (resolved: ResolvedCommand, cwd: string, logger: Console): number => {
    for (const warning of resolved.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    return requireNative().execPmCommandInteractive(resolved.bin, resolved.args, cwd);
};

const resolveAndRun = (nativeCall: (native: NonNullable<ReturnType<typeof loadNativeBindings>>) => ResolvedCommand, cwd: string, logger: Console): number => {
    const resolved = nativeCall(requireNative());

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
    resolveAndRun((native) => native.resolveLink(pm.name, pm.version, target), cwd, logger);

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
