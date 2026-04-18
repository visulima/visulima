/**
 * Shared helper for executing package manager commands via native Rust bindings.
 * Falls back to JS-based detection when native bindings are unavailable.
 */

import { readdirSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";
import { coerce, lt } from "semver";

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

        if (isAccessibleSync(pkgPath)) {
            const pkg = readJsonSync(pkgPath) as { packageManager?: string };

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
 * Checks if a directory contains lockfiles or packageManager config
 * for any PM. Reads the listing once + probes a Set rather than
 * `stat`-ing each candidate filename individually.
 */
const detectPmInDir = (dir: string): PmInfo | undefined => {
    let entries: Set<string>;

    try {
        entries = new Set(readdirSync(dir));
    } catch {
        return undefined;
    }

    if (entries.has("pnpm-lock.yaml") || entries.has("pnpm-workspace.yaml")) {
        return { name: "pnpm", version: readPackageManagerVersion(dir, "pnpm") ?? "latest" };
    }

    if (entries.has("yarn.lock")) {
        return { name: "yarn", version: readPackageManagerVersion(dir, "yarn") ?? "latest" };
    }

    if (entries.has("bun.lock") || entries.has("bun.lockb")) {
        return { name: "bun", version: readPackageManagerVersion(dir, "bun") ?? "latest" };
    }

    if (entries.has("package-lock.json") || entries.has("npm-shrinkwrap.json")) {
        return { name: "npm", version: readPackageManagerVersion(dir, "npm") ?? "latest" };
    }

    if (!entries.has("package.json")) {
        return undefined;
    }

    try {
        const pkg = readJsonSync(join(dir, "package.json")) as { packageManager?: string };

        if (pkg.packageManager) {
            const match = /^(pnpm|yarn|npm|bun)@(.+)$/.exec(pkg.packageManager);

            if (match) {
                return { name: match[1] as PmInfo["name"], version: match[2] as string };
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
    if (!isAccessibleSync(cwd)) {
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

interface InfoOptions {
    fields: string[];
    json: boolean;
    package: string;
}

/**
 * Resolves a registry metadata lookup to a runnable command. Built in TS
 * rather than the Rust resolver because bun needs `pm view` (two-word
 * subcommand) and yarn berry needs `yarn npm info` — both shapes the existing
 * `resolve_pm_command` view branch gets wrong.
 *
 * Pure function — exported for unit testing.
 */
const resolveInfo = (pm: PmInfo, options: InfoOptions): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];
    const bin = pm.name;

    // `--` is a POSIX argv "end of options" marker. Every PM's view/info
    // subcommand respects it. Inserting it before the user-supplied package
    // name prevents a name starting with `-` (e.g. `-rf`, `--registry=...`)
    // from being reinterpreted as a flag by the underlying tool.
    switch (pm.name) {
        case "bun": {
            // `bun pm view` landed in bun 1.3. Older bun has no registry-info command;
            // warn the user and let bun exit with its own "unknown subcommand" error.
            const coerced = coerce(pm.version);

            if (coerced && lt(coerced, "1.3.0")) {
                warnings.push(
                    `bun ${pm.version} does not support \`bun pm view\` (added in bun 1.3). Upgrade bun, or run \`npm view ${options.package}\` instead.`,
                );
            }

            args.push("pm", "view", "--", options.package, ...options.fields);

            if (options.json) {
                args.push("--json");
            }

            break;
        }
        case "npm":
        case "pnpm": {
            args.push("view", "--", options.package, ...options.fields);

            if (options.json) {
                args.push("--json");
            }

            break;
        }
        case "yarn": {
            if (pm.version.startsWith("1.")) {
                args.push("info", "--", options.package);

                const [firstField, ...rest] = options.fields;

                if (firstField !== undefined) {
                    if (rest.length > 0) {
                        warnings.push("yarn v1 only supports querying one field at a time; using the first.");
                    }

                    args.push(firstField);
                }

                if (options.json) {
                    args.push("--json");
                }
            } else {
                args.push("npm", "info", "--", options.package);

                if (options.fields.length > 0) {
                    warnings.push("yarn berry does not support field arguments to 'npm info'; ignoring.");
                }

                if (options.json) {
                    args.push("--json");
                }
            }

            break;
        }
        default: {
            const exhaustive: never = pm.name;

            throw new Error(`Unsupported package manager: ${exhaustive as string}`);
        }
    }

    return { args, bin, warnings };
};

const runInfo = (pm: PmInfo, options: InfoOptions, cwd: string, logger: Console): number => runResolved(resolveInfo(pm, options), cwd, logger);

/**
 * Resolves and runs a PM `link` operation. Passes `pm.version` to the native
 * resolver so it can warn about pnpm v11 restrictions (arg-less link and
 * global-store name resolution were removed). `target` is `null` for arg-less
 * link, or a package name / path string.
 */
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

export type { InfoOptions, PmInfo };
export { detectPm, resolveInfo, runAdd, runDedupe, runDlx, runExec, runInfo, runInstall, runLink, runOutdated, runPmSubcommand, runRemove, runUnlink, runWhy };
