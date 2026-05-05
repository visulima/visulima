/**
 * Shared helper for executing package manager commands via native Rust bindings.
 */

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { dirname, join, parse as parsePath } from "@visulima/path";
import { coerce, lt } from "semver";

import type { AddOptions, DlxOptions, ExecOptions, InstallOptions, OutdatedOptions, RemoveOptions, ResolvedCommand, WhyOptions } from "#native";
import {
    detectPackageManager,
    execPmCommandInteractive,
    resolveAdd,
    resolveDedupe,
    resolveDlx,
    resolveExec,
    resolveInstall,
    resolveLink,
    resolveOutdated,
    resolvePmCommand,
    resolveRemove,
    resolveUnlink,
    resolveWhy,
    whichBin,
} from "#native";

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
} from "../util/aube-resolver";

/**
 * Allowed `install.backend` values in `vis.config.ts`. `auto` means
 * "use aube if it is on PATH, otherwise fall back to lockfile-detected
 * PM." Any explicit name pins the choice, ignoring detection.
 */
type InstallBackend = "aube" | "auto" | "bun" | "deno" | "npm" | "pnpm" | "yarn";

interface PmInfo {
    name: "bun" | "deno" | "npm" | "pnpm" | "yarn";
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
 * Returns true if a binary is callable from PATH. Uses the native
 * `whichBin` (Rust `which` crate) for parity with the rest of `vis`'s
 * lookups — falling back to PATH walking would diverge subtly on
 * Windows (PATHEXT, app-execution aliases).
 */
const hasBinaryOnPath = (name: string): boolean => whichBin(name) !== null;

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
        ["deno.lock", "deno"],
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

const detectPm = (cwd: string): PmInfo => {
    if (!isAccessibleSync(cwd)) {
        throw new Error(`Could not detect package manager in ${cwd}. Directory does not exist.`);
    }

    const detected = detectPackageManager(cwd);

    return { name: detected.name as PmInfo["name"], version: detected.version || "latest" };
};

const runResolved = (resolved: ResolvedCommand, cwd: string, logger: Console): number => {
    for (const warning of resolved.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    return execPmCommandInteractive(resolved.bin, resolved.args, cwd);
};

const resolveAndRun = (nativeCall: () => ResolvedCommand, cwd: string, logger: Console): number => runResolved(nativeCall(), cwd, logger);

/**
 * Append PM-specific `--prefer-offline` to a resolved install command.
 *
 * Lives in TS rather than the Rust resolver because the native
 * `InstallOptions` ABI does not yet carry the flag, and we want to ship
 * the secure-by-default install behavior without an ABI bump. Once the
 * native binding learns the option, the post-process step here is a
 * single-line removal.
 */
const applyPreferOffline = (resolved: ResolvedCommand, pm: InstallerInfo["name"]): ResolvedCommand => {
    if (pm === "aube") {
        // aube has no prefer-offline; its install path resolves from the
        // local store first by design. No-op.
        return resolved;
    }

    if (pm === "deno") {
        // Deno's equivalent (`--cached-only`) is already wired into the
        // native install resolver when `offline` is set, so a separate
        // post-process flag would be redundant and would error if
        // duplicated.
        return resolved;
    }

    if (pm === "yarn") {
        // yarn classic: --prefer-offline ✓
        // yarn berry: no equivalent (network policy is configured via
        // `enableMirror` / `networkSettings` in .yarnrc.yml). Pass the
        // flag through anyway so yarn berry surfaces its own "unknown
        // option" error if the user explicitly set it — silently dropping
        // would hide intent.
    }

    return { ...resolved, args: [...resolved.args, "--prefer-offline"] };
};

interface RunInstallExtras {
    preferOffline?: boolean;
}

const runInstall = (pm: InstallerInfo, options: InstallOptions, cwd: string, logger: Console, extras: RunInstallExtras = {}): number => {
    // Aube's flag surface lives in TS (see `aube-resolver.ts`) until the
    // native binding learns about it. Short-circuit before the NAPI call
    // so we don't pay a cross-FFI hop for a 5-line argv build.
    let resolved = pm.name === "aube" ? resolveAubeInstall(options) : resolveInstall(pm.name, pm.version, options);

    if (extras.preferOffline) {
        resolved = applyPreferOffline(resolved, pm.name);
    }

    return runResolved(resolved, cwd, logger);
};

/**
 * Append PM-specific `--ignore-scripts` to a resolved add command. Same
 * post-process pattern as {@link applyPreferOffline} — the native
 * `AddOptions` does not carry `ignoreScripts`, but every supported PM
 * accepts the flag at the CLI surface.
 */
const applyIgnoreScripts = (resolved: ResolvedCommand, pm: InstallerInfo["name"]): ResolvedCommand => {
    if (pm === "aube") {
        // aube already skips dependency lifecycle scripts by default; the
        // flag is a no-op there. Pass it through so the user's intent is
        // visible in the resolved command.
        return { ...resolved, args: [...resolved.args, "--ignore-scripts"] };
    }

    if (pm === "deno") {
        // Deno blocks lifecycle scripts by default and rejects an
        // `--ignore-scripts` flag entirely. Skip the post-process.
        return resolved;
    }

    return { ...resolved, args: [...resolved.args, "--ignore-scripts"] };
};

interface RunAddExtras {
    /**
     * After a successful add, read each freshly-installed package's
     * `peerDependencies`, drop optional peers and ones already in the
     * workspace, and recursively add the rest. Mirrors nypm's
     * `installPeerDependencies` (default off).
     */
    autoInstallPeers?: boolean;
    ignoreScripts?: boolean;
}

const runAdd = (pm: InstallerInfo, options: AddOptions, cwd: string, logger: Console, extras: RunAddExtras = {}): number => {
    let resolved = pm.name === "aube" ? resolveAubeAdd(options) : resolveAdd(pm.name, pm.version, options);

    if (extras.ignoreScripts) {
        resolved = applyIgnoreScripts(resolved, pm.name);
    }

    const code = runResolved(resolved, cwd, logger);

    if (code === 0 && extras.autoInstallPeers) {
        installMissingPeers(pm, options, cwd, logger, extras);
    }

    return code;
};

/**
 * Strip the version range suffix from an add spec (`react@^18` →
 * `react`, `@scope/pkg@1.0` → `@scope/pkg`). Aliased specs like
 * `name@npm:other` resolve to `name` for peer-lookup purposes —
 * we read the alias's installed package.json by alias name, since
 * that is where node_modules places it.
 */
const stripVersionRange = (spec: string): string => {
    if (spec.startsWith("@")) {
        const slash = spec.indexOf("/");

        if (slash === -1) {
            return spec;
        }

        const at = spec.indexOf("@", slash);

        return at === -1 ? spec : spec.slice(0, at);
    }

    const at = spec.indexOf("@");

    return at === -1 ? spec : spec.slice(0, at);
};

interface InstalledManifest {
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface WorkspaceManifest {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

const readJson = (path: string): unknown => {
    if (!isAccessibleSync(path)) {
        return undefined;
    }

    try {
        return JSON.parse(readFileSync(path, { buffer: false }));
    } catch {
        return undefined;
    }
};

/**
 * Locate the installed package.json for `name` starting at `from`.
 * Walks up `node_modules` along parent directories — covers both
 * pnpm's symlink-into-.pnpm layout (the symlink resolves) and the
 * hoisted layouts used by npm/yarn/bun.
 */
const findInstalledManifest = (from: string, name: string): InstalledManifest | undefined => {
    let dir = from;

    while (true) {
        const candidate = join(dir, "node_modules", name, "package.json");
        const manifest = readJson(candidate) as InstalledManifest | undefined;

        if (manifest) {
            return manifest;
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return undefined;
        }

        dir = parent;
    }
};

const collectExistingDeps = (cwd: string): Set<string> => {
    const manifest = readJson(join(cwd, "package.json")) as WorkspaceManifest | undefined;
    const existing = new Set<string>();

    if (!manifest) {
        return existing;
    }

    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
        const block = manifest[section];

        if (block) {
            for (const name of Object.keys(block)) {
                existing.add(name);
            }
        }
    }

    return existing;
};

/**
 * Walk freshly-installed packages, gather their `peerDependencies`,
 * filter optional + already-present, and dispatch a recursive add for
 * the rest. Failures are logged, not thrown — the primary add already
 * succeeded and we don't want a peer-resolution glitch to flip the
 * exit code.
 */
const installMissingPeers = (
    pm: InstallerInfo,
    options: AddOptions,
    cwd: string,
    logger: Console,
    extras: RunAddExtras,
): void => {
    if (pm.name === "deno") {
        // Deno doesn't model peer dependencies. Skip silently.
        return;
    }

    const existing = collectExistingDeps(cwd);
    const requested = new Map<string, string>();

    for (const spec of options.packages) {
        const pkgName = stripVersionRange(spec);
        const manifest = findInstalledManifest(cwd, pkgName);

        if (!manifest?.peerDependencies) {
            continue;
        }

        const meta = manifest.peerDependenciesMeta ?? {};

        for (const [peerName, peerRange] of Object.entries(manifest.peerDependencies)) {
            if (meta[peerName]?.optional) {
                continue;
            }

            if (existing.has(peerName) || requested.has(peerName)) {
                continue;
            }

            requested.set(peerName, peerRange);
        }
    }

    if (requested.size === 0) {
        return;
    }

    const peerSpecs = [...requested.entries()].map(([name, range]) => `${name}@${range}`);

    logger.log(`auto-installing peer dependencies: ${peerSpecs.join(", ")}`);

    const peerOptions: AddOptions = {
        exact: false,
        filter: options.filter,
        global: false,
        optional: false,
        packages: peerSpecs,
        peer: false,
        saveDev: options.saveDev,
        workspace: false,
        workspaceRoot: options.workspaceRoot,
    };

    // Recurse with autoInstallPeers off — we resolve one transitive
    // layer per add, matching nypm. Multi-level peer trees can be
    // surfaced by re-running `vis add` if needed.
    runAdd(pm, peerOptions, cwd, logger, { ignoreScripts: extras.ignoreScripts });
};

const runRemove = (pm: InstallerInfo, options: RemoveOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeRemove(options), cwd, logger);
    }

    return resolveAndRun(() => resolveRemove(pm.name, pm.version, options), cwd, logger);
};

const runDedupe = (pm: InstallerInfo, check: boolean, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeDedupe(check), cwd, logger);
    }

    return resolveAndRun(() => resolveDedupe(pm.name, pm.version, check), cwd, logger);
};

const runWhy = (pm: InstallerInfo, options: WhyOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeWhy(options), cwd, logger);
    }

    return resolveAndRun(() => resolveWhy(pm.name, pm.version, options), cwd, logger);
};

const runOutdated = (pm: InstallerInfo, options: OutdatedOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeOutdated(options), cwd, logger);
    }

    return resolveAndRun(() => resolveOutdated(pm.name, pm.version, options), cwd, logger);
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
        case "deno": {
            // `deno info <module>` is module-rooted and prints a graph
            // rather than registry metadata, but it's the closest thing
            // deno ships. For npm specs prepend `npm:` so the lookup
            // resolves through deno's npm-compat path.
            const spec = options.package.startsWith("npm:")
                || options.package.startsWith("jsr:")
                || options.package.startsWith("https://")
                || options.package.startsWith("http://")
                || options.package.startsWith("file:")
                ? options.package
                : `npm:${options.package}`;

            args.push("info", "--", spec);

            if (options.json) {
                args.push("--json");
            }

            if (options.fields.length > 0) {
                warnings.push("deno info does not accept field selectors; ignoring.");
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

    return resolveAndRun(() => resolveLink(pm.name, pm.version, target), cwd, logger);
};

const runUnlink = (pm: InstallerInfo, packages: string[], recursive: boolean, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeUnlink(packages, recursive), cwd, logger);
    }

    return resolveAndRun(() => resolveUnlink(pm.name, pm.version, packages, recursive), cwd, logger);
};

const runDlx = (pm: InstallerInfo, options: DlxOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeDlx(options), cwd, logger);
    }

    return resolveAndRun(() => resolveDlx(pm.name, pm.version, options), cwd, logger);
};

const runExec = (pm: InstallerInfo, options: ExecOptions, cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubeExec(options), cwd, logger);
    }

    return resolveAndRun(() => resolveExec(pm.name, pm.version, options), cwd, logger);
};

const runPmSubcommand = (pm: InstallerInfo, subcommand: string, args: string[], cwd: string, logger: Console): number => {
    if (pm.name === "aube") {
        return runResolved(resolveAubePmCommand(subcommand, args), cwd, logger);
    }

    return resolveAndRun(() => resolvePmCommand(pm.name, pm.version, subcommand, args), cwd, logger);
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
