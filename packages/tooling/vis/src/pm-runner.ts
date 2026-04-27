/**
 * Shared helper for executing package manager commands via native Rust bindings.
 * Falls back to JS-based detection when native bindings are unavailable.
 */

import { readdirSync } from "node:fs";

import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";
import { coerce, lt } from "semver";

import {
    resolveAubeAdd,
    resolveAubeDedupe,
    resolveAubeDlx,
    resolveAubeExec,
    resolveAubeInfo,
    resolveAubeInstall,
    resolveAubeLink,
    resolveAubeOutdated,
    resolveAubePmCommand,
    resolveAubeRemove,
    resolveAubeUnlink,
    resolveAubeWhy,
} from "./aube-resolver";
import type { AddOptions, DlxOptions, ExecOptions, InstallOptions, OutdatedOptions, RemoveOptions, ResolvedCommand, WhyOptions } from "./native-binding";
import { loadNativeBindings } from "./native-binding";

/**
 * Allowed `install.backend` values in `vis.config.ts`. `auto` means
 * "use aube if it is on PATH, otherwise fall back to lockfile-detected
 * PM." Any explicit name pins the choice, ignoring detection.
 */
type InstallBackend = "aube" | "auto" | "bun" | "npm" | "pnpm" | "yarn";

interface PmInfo {
    name: "bun" | "npm" | "pnpm" | "yarn";
    version: string;
}

/**
 * Strict superset of {@link PmInfo} that also admits `aube`. Used only
 * on the installer path (`runInstall`, `resolveInstaller`). Detection
 * helpers and PM-specific code paths (overrides, doctor, optimize,
 * approve-builds) keep the narrower {@link PmInfo} because aube reuses
 * the underlying PM's lockfile and behavior — there is no aube-specific
 * override resolution or doctor check to run.
 */
interface InstallerInfo {
    name: "aube" | PmInfo["name"];
    version: string;
}

/**
 * Returns true if a binary is callable from PATH. Prefers the native
 * `whichBin` (Rust `which` crate) for parity with the rest of `vis`'s
 * lookups, with no JS fallback — `which` is always present once the
 * native addon loads, and falling back to PATH walking would diverge
 * subtly on Windows (PATHEXT, app-execution aliases). When the native
 * addon is unavailable, we conservatively report "not found" so `auto`
 * mode picks the lockfile-detected PM.
 */
const hasBinaryOnPath = (name: string): boolean => {
    const native = loadNativeBindings();

    if (!native) {
        return false;
    }

    return native.whichBin(name) !== null;
};

/**
 * Walk up from `start` looking for the nearest non-aube lockfile, returning
 * the PM that wrote it. We can't rely on {@link detectPm} for this because
 * the native detector defaults to "pnpm" when nothing matches — that'd
 * produce false-positive drift warnings for greenfield aube workspaces.
 * Here we only return when an actual lockfile file is found on disk.
 *
 * `pnpm-workspace.yaml` is excluded — it's a workspace config, not a
 * lockfile, and aube reads it natively without rewriting it.
 */
const findNonAubeLockfile = (start: string): PmInfo["name"] | undefined => {
    const lockfiles: ReadonlyArray<readonly [string, PmInfo["name"]]> = [
        ["pnpm-lock.yaml", "pnpm"],
        ["yarn.lock", "yarn"],
        ["package-lock.json", "npm"],
        ["npm-shrinkwrap.json", "npm"],
        ["bun.lock", "bun"],
        ["bun.lockb", "bun"],
    ];

    let dir = start;

    while (true) {
        for (const [file, pm] of lockfiles) {
            if (isAccessibleSync(join(dir, file))) {
                return pm;
            }
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return undefined;
        }

        dir = parent;
    }
};

/**
 * Detect cross-tool lockfile drift before a mutating install.
 *
 * Aube reads/writes pnpm/npm/yarn/bun lockfiles in place but its
 * serialized output is not byte-identical to the original tool's —
 * the first aube install on a workspace whose lockfile was written by
 * pnpm/npm/yarn/bun will produce a one-time churn diff in git, and
 * teams that mix tools on the same lockfile will see repeated drift.
 *
 * Returns a user-facing warning when the resolved installer is aube
 * and the workspace already has a non-aube lockfile. Greenfield
 * workspaces (no lockfile at all) and aube-only workspaces return
 * `undefined`.
 *
 * Pure read-only — safe to call before any mutating PM operation.
 */
const detectLockfileDrift = (cwd: string, installer: InstallerInfo): string | undefined => {
    if (installer.name !== "aube") {
        return undefined;
    }

    const detected = findNonAubeLockfile(cwd);

    if (detected === undefined) {
        return undefined;
    }

    return (
        `Resolved installer is aube but the workspace has a ${detected} lockfile. `
        + `Aube reads and writes ${detected}'s lockfile format in place, but its byte output may differ subtly — `
        + "expect a one-time churn diff on the first install, and ongoing drift if your team mixes tools on the same lockfile. "
        + "To pin the choice across the team, set `install.backend` in vis.config; to bypass aube for this run, pass --no-aube."
    );
};

/**
 * Resolve which package manager `vis install` (and friends) should use.
 *
 * Precedence: explicit CLI flag → `VIS_INSTALLER` env var → `vis.config.ts`
 * `install.backend` → auto-detect. Auto mode picks `aube` when it is on
 * PATH, otherwise falls back to lockfile-based detection via {@link detectPm}.
 *
 * Throws when an explicit choice is missing from PATH so the user gets a
 * clear failure instead of a downstream "command not found".
 */
const resolveInstaller = (cwd: string, override: { backend?: InstallBackend; configBackend?: InstallBackend }): InstallerInfo => {
    const cliBackend = override.backend;
    const envBackend = process.env.VIS_INSTALLER as InstallBackend | undefined;
    const explicit = cliBackend ?? envBackend ?? override.configBackend;

    if (explicit && explicit !== "auto") {
        if (explicit === "aube" && !hasBinaryOnPath("aube")) {
            throw new Error(
                "install.backend is set to \"aube\" but the `aube` binary is not on PATH. "
                + "Install it via `npm i -g @endevco/aube`, `mise use -g aube`, or `brew install endevco/tap/aube`.",
            );
        }

        return { name: explicit, version: "latest" };
    }

    if (hasBinaryOnPath("aube")) {
        return { name: "aube", version: "latest" };
    }

    return detectPm(cwd);
};

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

const runInstall = (pm: InstallerInfo, options: InstallOptions, cwd: string, logger: Console): number => {
    // Aube's flag surface lives in TS (see `aube-resolver.ts`) until the
    // native binding learns about it. Short-circuit before the NAPI call
    // so we don't pay a cross-FFI hop for a 5-line argv build.
    if (pm.name === "aube") {
        return runResolved(resolveAubeInstall(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveInstall(pm.name, pm.version, options), cwd, logger);
};

const runAdd = (pm: InstallerInfo, options: AddOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeAdd(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveAdd(pm.name, pm.version, options), cwd, logger);
};

const runRemove = (pm: InstallerInfo, options: RemoveOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeRemove(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveRemove(pm.name, pm.version, options), cwd, logger);
};

const runDedupe = (pm: InstallerInfo, check: boolean, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeDedupe(check), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveDedupe(pm.name, pm.version, check), cwd, logger);
};

const runWhy = (pm: InstallerInfo, options: WhyOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeWhy(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveWhy(pm.name, pm.version, options), cwd, logger);
};

const runOutdated = (pm: InstallerInfo, options: OutdatedOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeOutdated(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveOutdated(pm.name, pm.version, options), cwd, logger);
};

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
const resolveInfo = (pm: InstallerInfo, options: InfoOptions): ResolvedCommand => {
    if (pm.name === "aube") {
        return resolveAubeInfo(options);
    }

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

const runInfo = (pm: InstallerInfo, options: InfoOptions, cwd: string, logger: Console): number => runResolved(resolveInfo(pm, options), cwd, logger);

/**
 * Resolves and runs a PM `link` operation. Passes `pm.version` to the native
 * resolver so it can warn about pnpm v11 restrictions (arg-less link and
 * global-store name resolution were removed). `target` is `null` for arg-less
 * link, or a package name / path string.
 */
const runLink = (pm: InstallerInfo, target: string | null, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeLink(target), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveLink(pm.name, pm.version, target), cwd, logger);
};

const runUnlink = (pm: InstallerInfo, packages: string[], recursive: boolean, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeUnlink(packages, recursive), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveUnlink(pm.name, pm.version, packages, recursive), cwd, logger);
};

const runDlx = (pm: InstallerInfo, options: DlxOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeDlx(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveDlx(pm.name, pm.version, options), cwd, logger);
};

const runExec = (pm: InstallerInfo, options: ExecOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeExec(options), cwd, logger);
    }

    return resolveAndRun((native) => native.resolveExec(pm.name, pm.version, options), cwd, logger);
};

const runPmSubcommand = (pm: InstallerInfo, subcommand: string, args: string[], cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubePmCommand(subcommand, args), cwd, logger);
    }

    return resolveAndRun((native) => native.resolvePmCommand(pm.name, pm.version, subcommand, args), cwd, logger);
};

export type { InfoOptions, InstallBackend, InstallerInfo, PmInfo };
export {
    detectLockfileDrift,
    detectPm,
    resolveInfo,
    resolveInstaller,
    runAdd,
    runDedupe,
    runDlx,
    runExec,
    runInfo,
    runInstall,
    runLink,
    runOutdated,
    runPmSubcommand,
    runRemove,
    runUnlink,
    runWhy,
};
