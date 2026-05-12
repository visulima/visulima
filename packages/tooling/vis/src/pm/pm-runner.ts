import { spawnSync } from "node:child_process";

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
import { dispatchSubcommand } from "./pm-subcommand-dispatch";

/**
 * Allowed `install.backend` values in `vis.config.ts`. `auto` means
 * "use aube if it is on PATH, otherwise fall back to lockfile-detected
 * PM." Any explicit name pins the choice, ignoring detection.
 */
type InstallBackend = "aube" | "auto" | "bun" | "deno" | "npm" | "pnpm" | "yarn";

/**
 * Allowed `install.corepack` values in `vis.config.ts`. See the type
 * docs in {@link "../config/types".VisConfig.install.corepack} for the
 * matrix.
 */
type CorepackMode = "auto" | boolean;

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
 *
 * `useCorepack` is computed once in {@link resolveInstaller}. When set,
 * resolved commands get a `corepack` prefix at exec time (see
 * {@link applyCorepack}).
 */
interface InstallerInfo {
    name: "aube" | PmInfo["name"];

    /**
     * Optional: defaults to false. Only set by {@link resolveInstaller};
     * other construction paths (e.g. {@link detectPm} for SDK install)
     * leave it undefined and execute the PM directly.
     */
    useCorepack?: boolean;
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
 * Read the `packageManager` field from the workspace's `package.json`.
 * Returns the raw string ("pnpm@10.14.0" / "yarn@4.0.0+sha512...") or
 * `undefined` when the file/field is missing or unreadable.
 *
 * Used by {@link shouldUseCorepack} to drive `auto` mode: if no field
 * is pinned, there is nothing for corepack to resolve, so we don't
 * wrap the invocation.
 */
const readPackageManagerField = (cwd: string): string | undefined => {
    let dir = cwd;

    while (true) {
        const candidate = join(dir, "package.json");
        const manifest = readJson(candidate) as { packageManager?: unknown } | undefined;

        if (manifest && typeof manifest.packageManager === "string" && manifest.packageManager.length > 0) {
            return manifest.packageManager;
        }

        const parent = dirname(dir);

        if (parent === dir || parsePath(dir).root === dir) {
            return undefined;
        }

        dir = parent;
    }
};

/**
 * PMs that corepack manages. Bun and deno are excluded — corepack does
 * not ship shims for them. Aube has its own resolver path. npm is
 * supported by corepack but rarely dispatched that way; we include it
 * so an explicit `install.corepack: true` covers all three managed
 * tools.
 */
const COREPACK_MANAGED: ReadonlySet<string> = new Set(["npm", "pnpm", "yarn"]);

/**
 * Compute whether resolved PM commands should be wrapped with
 * `corepack &lt;pm>`. Mirrors nypm's `corepack: true` flag. The `auto`
 * default opts in only when:
 *   1. the workspace pins a PM via `packageManager` (so corepack has
 *      something to resolve), and
 *   2. `corepack` is on PATH, and
 *   3. the resolved PM is one corepack manages.
 *
 * Explicit `true` skips condition (1) — useful when the caller knows
 * corepack is the right entry point even without a pin (e.g. a fresh
 * clone before the `packageManager` field is added).
 */
const shouldUseCorepack = (cwd: string, pmName: InstallerInfo["name"], mode: CorepackMode): boolean => {
    if (mode === false) {
        return false;
    }

    if (!COREPACK_MANAGED.has(pmName)) {
        return false;
    }

    if (!hasBinaryOnPath("corepack")) {
        return false;
    }

    if (mode === true) {
        return true;
    }

    return readPackageManagerField(cwd) !== undefined;
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
const resolveInstaller = (
    cwd: string,
    override: { backend?: InstallBackend; configBackend?: InstallBackend; configCorepack?: CorepackMode },
): InstallerInfo => {
    const cliBackend = override.backend;
    const envBackend = process.env.VIS_INSTALLER as InstallBackend | undefined;
    const explicit = cliBackend ?? envBackend ?? override.configBackend;
    const corepackMode: CorepackMode = override.configCorepack ?? "auto";

    if (explicit && explicit !== "auto") {
        if (explicit === "aube" && !hasBinaryOnPath("aube")) {
            throw new Error(
                "install.backend is set to \"aube\" but the `aube` binary is not on PATH. "
                + "Install it via `npm i -g @endevco/aube`, `mise use -g aube`, or `brew install endevco/tap/aube`.",
            );
        }

        return { name: explicit, useCorepack: shouldUseCorepack(cwd, explicit, corepackMode), version: "latest" };
    }

    if (hasBinaryOnPath("aube")) {
        return { name: "aube", useCorepack: false, version: "latest" };
    }

    const pm = detectPm(cwd);

    return { ...pm, useCorepack: shouldUseCorepack(cwd, pm.name, corepackMode) };
};

const detectPm = (cwd: string): PmInfo => {
    if (!isAccessibleSync(cwd)) {
        throw new Error(`Could not detect package manager in ${cwd}. Directory does not exist.`);
    }

    const detected = detectPackageManager(cwd);

    return { name: detected.name as PmInfo["name"], version: detected.version || "latest" };
};

/**
 * Wrap a resolved PM command with `corepack &lt;pm>` when the installer
 * was tagged for corepack dispatch. No-op when `useCorepack` is false,
 * the resolved bin is not a corepack-managed PM, or the command was
 * already wrapped (defensive — keeps the helper idempotent).
 */
const applyCorepack = (resolved: ResolvedCommand, pm: InstallerInfo): ResolvedCommand => {
    // Skip wrapping when:
    //   - corepack is disabled for this installer,
    //   - the resolved PM is not corepack-managed (bun, deno, aube),
    //   - the command is already corepack-wrapped (idempotency), or
    //   - the resolved bin diverges from the installer's PM (e.g. the
    //     subcommand dispatcher rewrote `pnpm whoami` → `npm whoami` for
    //     pnpm 11). Wrapping a foreign bin under `corepack pnpm` would
    //     re-route the call through the wrong tool.
    if (pm.useCorepack !== true || !COREPACK_MANAGED.has(pm.name) || resolved.bin === "corepack" || resolved.bin !== pm.name) {
        return resolved;
    }

    return { ...resolved, args: [pm.name, ...resolved.args], bin: "corepack" };
};

/**
 * Per-call execution overrides shared across all `run*` helpers.
 *
 * - `env`: extra environment variables for this single invocation.
 *   Merged into `process.env`; the underlying spawn uses Node's
 *   `spawnSync` instead of the native exec to avoid leaking env into
 *   sibling processes. Pass `{}` to opt out.
 * - `dry`: print the resolved command but do not execute it. Returns
 *   `0`. Useful for embedders previewing what `vis` would do.
 */
interface RunOverrides {
    dry?: boolean;
    env?: Record<string, string>;
}

/**
 * Execute a resolved command with optional per-call env injection.
 *
 * The native `execPmCommandInteractive` inherits `process.env` and
 * cannot accept ad-hoc overrides. When `env` is provided, fall back
 * to Node's `spawnSync` with merged env — same `inherit` stdio
 * semantics, slightly slower process spawn but identical exit-code
 * handling. Without `env`, the fast native path is used.
 */
const spawnResolved = (resolved: ResolvedCommand, cwd: string, env?: Record<string, string>): number => {
    if (env === undefined) {
        return execPmCommandInteractive(resolved.bin, resolved.args, cwd);
    }

    // Caller's `env` overrides inherited `process.env` (last-write-wins
    // via spread). Trust boundary is the caller — env is not validated;
    // callers must not forward untrusted user input into this map.
    const result = spawnSync(resolved.bin, resolved.args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }

    return result.status ?? 1;
};

const runResolved = (pm: InstallerInfo, resolved: ResolvedCommand, cwd: string, logger: Console, overrides: RunOverrides = {}): number => {
    const final = applyCorepack(resolved, pm);

    for (const warning of final.warnings) {
        logger.warn(`warning: ${warning}`);
    }

    if (overrides.dry) {
        logger.log(`[dry-run] ${final.bin} ${final.args.join(" ")}`);

        return 0;
    }

    return spawnResolved(final, cwd, overrides.env);
};

const resolveAndRun = (pm: InstallerInfo, nativeCall: () => ResolvedCommand, cwd: string, logger: Console, overrides: RunOverrides = {}): number =>
    runResolved(pm, nativeCall(), cwd, logger, overrides);

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

interface RunInstallExtras extends RunOverrides {
    /**
     * CI-grade lockfile enforcement. When the resolved installer is yarn
     * berry, appends `--immutable-cache` on top of the `--immutable`
     * already emitted by the Rust resolver for frozen installs — the
     * pair that the npm security best-practices guide recommends for
     * "lockfile-enforced installations." No-op for every other PM
     * because their frozen-install behavior already covers the cache
     * (npm ci wipes node_modules; pnpm/bun/deno frozen modes never
     * touch the store mid-install). Yarn classic's `--frozen-lockfile`
     * predates the split and similarly does not write to the cache.
     */
    ciMode?: boolean;
    preferOffline?: boolean;
    silent?: boolean;
}

/**
 * Append yarn berry's `--immutable-cache` to a frozen install command.
 * Pairs with the `--immutable` already emitted by the Rust resolver to
 * give CI the full lockfile-enforced install surface (lockfile is not
 * mutated AND the offline mirror cache is not mutated). Skipped when
 * `--immutable` is absent — without it, `--immutable-cache` is a yarn
 * error rather than a stricter mode.
 *
 * Only yarn berry has the flag. Yarn classic, pnpm, npm, bun, deno, and
 * aube all return the command unchanged.
 */
const applyImmutableCache = (resolved: ResolvedCommand, pm: InstallerInfo["name"], version: string): ResolvedCommand => {
    if (pm !== "yarn" || version.startsWith("1.")) {
        return resolved;
    }

    if (!resolved.args.includes("--immutable")) {
        return resolved;
    }

    if (resolved.args.includes("--immutable-cache")) {
        return resolved;
    }

    return { ...resolved, args: [...resolved.args, "--immutable-cache"] };
};

const runInstall = (pm: InstallerInfo, options: InstallOptions, cwd: string, logger: Console, extras: RunInstallExtras = {}): number => {
    // `silent` is wired into the native `InstallOptions` ABI, so we
    // merge it into `options` rather than post-processing — the Rust
    // resolver controls flag emission per PM. Add/remove use the
    // post-process `applySilent` because their ABI lacks the field.
    //
    // Aube's flag surface lives in TS (see `aube-resolver.ts`) until the
    // native binding learns about it. Short-circuit before the NAPI call
    // so we don't pay a cross-FFI hop for a 5-line argv build.
    let resolved
        = pm.name === "aube"
            ? resolveAubeInstall(options)
            : resolveInstall(pm.name, pm.version, { ...options, silent: options.silent || extras.silent === true });

    if (extras.preferOffline) {
        resolved = applyPreferOffline(resolved, pm.name);
    }

    if (extras.ciMode) {
        resolved = applyImmutableCache(resolved, pm.name, pm.version);
    }

    return runWithNativeDryRun(pm, resolved, cwd, logger, { dry: extras.dry, env: extras.env });
};

/**
 * Append the PM-specific silent flag. npm/pnpm/bun/yarn (classic +
 * berry) all accept `--silent` (yarn berry treats it as an alias for
 * `--quiet`). Deno only supports `--quiet`. Aube has no flag and
 * forwards verbatim — the resolver already controls its output level.
 */
const applySilent = (resolved: ResolvedCommand, pm: InstallerInfo["name"]): ResolvedCommand => {
    const flag = pm === "deno" ? "--quiet" : "--silent";

    return { ...resolved, args: [...resolved.args, flag] };
};

/**
 * Append the PM-specific dry-run flag, or return `null` when the PM
 * has no native dry-run for the current op. Callers that get `null`
 * should fall back to {@link runResolved}'s `dry` print-and-skip path
 * so we never forward a flag the PM is known to reject.
 *
 * - npm / pnpm / bun: support `--dry-run` on install/add/remove.
 * - deno: `deno install --dry-run` exists; on `add` it's accepted too.
 * - yarn classic: no `--dry-run` on add/install. yarn berry has
 *   `--mode=skip-build` but no true dry-run. Both → `null`.
 * - aube: no native dry-run. → `null`.
 */
const applyDryRun = (resolved: ResolvedCommand, pm: InstallerInfo["name"]): ResolvedCommand | null => {
    if (pm === "yarn" || pm === "aube") {
        return null;
    }

    return { ...resolved, args: [...resolved.args, "--dry-run"] };
};

/**
 * Run a resolved command honoring `dry` uniformly: when the PM has a
 * native `--dry-run`, post-process and let the PM execute (so users
 * see resolutions, store deltas, etc.). Otherwise fall back to print
 * and skip — same outcome from the user's perspective.
 *
 * Used only by ops where a PM-native dry-run is meaningful (install /
 * add / remove). Other ops (link, exec, dlx, info, …) skip via
 * {@link runResolved}'s `dry` directly.
 */
const runWithNativeDryRun = (pm: InstallerInfo, resolved: ResolvedCommand, cwd: string, logger: Console, overrides: RunOverrides): number => {
    if (overrides.dry !== true) {
        return runResolved(pm, resolved, cwd, logger, overrides);
    }

    const native = applyDryRun(resolved, pm.name);

    if (native === null) {
        return runResolved(pm, resolved, cwd, logger, overrides);
    }

    return runResolved(pm, native, cwd, logger, { env: overrides.env });
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

interface RunAddExtras extends RunOverrides {
    /**
     * After a successful add, read each freshly-installed package's
     * `peerDependencies`, drop optional peers and ones already in the
     * workspace, and recursively add the rest. Mirrors nypm's
     * `installPeerDependencies` (default off).
     */
    autoInstallPeers?: boolean;
    ignoreScripts?: boolean;
    silent?: boolean;
}

const runAdd = (pm: InstallerInfo, options: AddOptions, cwd: string, logger: Console, extras: RunAddExtras = {}): number => {
    let resolved = pm.name === "aube" ? resolveAubeAdd(options) : resolveAdd(pm.name, pm.version, options);

    if (extras.ignoreScripts) {
        resolved = applyIgnoreScripts(resolved, pm.name);
    }

    if (extras.silent) {
        resolved = applySilent(resolved, pm.name);
    }

    const code = runWithNativeDryRun(pm, resolved, cwd, logger, { dry: extras.dry, env: extras.env });

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
const installMissingPeers = (pm: InstallerInfo, options: AddOptions, cwd: string, logger: Console, extras: RunAddExtras): void => {
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

interface RunRemoveExtras extends RunOverrides {
    silent?: boolean;
}

const runRemove = (pm: InstallerInfo, options: RemoveOptions, cwd: string, logger: Console, extras: RunRemoveExtras = {}): number => {
    let resolved = pm.name === "aube" ? resolveAubeRemove(options) : resolveRemove(pm.name, pm.version, options);

    if (extras.silent) {
        resolved = applySilent(resolved, pm.name);
    }

    return runWithNativeDryRun(pm, resolved, cwd, logger, { dry: extras.dry, env: extras.env });
};

const runDedupe = (pm: InstallerInfo, check: boolean, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeDedupe(check), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveDedupe(pm.name, pm.version, check), cwd, logger, extras);
};

const runWhy = (pm: InstallerInfo, options: WhyOptions, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeWhy(options), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveWhy(pm.name, pm.version, options), cwd, logger, extras);
};

const runOutdated = (pm: InstallerInfo, options: OutdatedOptions, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeOutdated(options), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveOutdated(pm.name, pm.version, options), cwd, logger, extras);
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
            const spec
                = options.package.startsWith("npm:")
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

const runInfo = (pm: InstallerInfo, options: InfoOptions, cwd: string, logger: Console, extras: RunOverrides = {}): number =>
    runResolved(pm, resolveInfo(pm, options), cwd, logger, extras);

/**
 * Resolves and runs a PM `link` operation. Passes `pm.version` to the native
 * resolver so it can warn about pnpm v11 restrictions (arg-less link and
 * global-store name resolution were removed). `target` is `null` for arg-less
 * link, or a package name / path string.
 */
const runLink = (pm: InstallerInfo, target: string | null, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeLink(target), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveLink(pm.name, pm.version, target), cwd, logger, extras);
};

const runUnlink = (pm: InstallerInfo, packages: string[], recursive: boolean, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeUnlink(packages, recursive), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveUnlink(pm.name, pm.version, packages, recursive), cwd, logger, extras);
};

interface RunDlxExtras extends RunOverrides {
    /**
     * Restrict resolution to the local PM store / npm cache and refuse
     * to fetch from the network. Mirrors the "harden npx" guidance from
     * the npm security best-practices list — the recommended flow is to
     * pre-install the package via `vis install` (lockfile-locked) and
     * then run `vis dlx --offline &lt;pkg>` so the dlx step never hits the
     * registry.
     *
     * Implemented as a TS post-process rather than a native `DlxOptions`
     * field because the flag is purely additive and each PM has its own
     * spelling: pnpm/npm/yarn-classic-fallback → `--offline`, deno →
     * `--cached-only`. Bun and yarn berry have no offline dlx mode; the
     * helper logs a warning and forwards the command unchanged so the
     * user knows their intent did not fully apply.
     */
    offline?: boolean;
}

/**
 * Splice the PM-specific offline flag into a resolved dlx command,
 * right after the dlx subcommand keyword so it isn't reinterpreted as
 * a flag to the package being executed (the user's args follow the
 * package name on the resolved command line).
 *
 * Returns the unchanged command plus a warning when the PM has no
 * native offline mode for dlx — bun x predates `bun install --offline`
 * adopting the dlx surface, and yarn berry models network policy via
 * `.yarnrc.yml` (`enableNetwork`) rather than a per-call flag. We surface
 * those gaps via `warnings` instead of failing so the user sees the
 * limitation without losing the run.
 */
const applyDlxOffline = (resolved: ResolvedCommand, pm: InstallerInfo["name"], version: string): ResolvedCommand => {
    if (resolved.args.includes("--offline") || resolved.args.includes("--cached-only")) {
        return resolved;
    }

    const insertAt = (flag: string, position: number): ResolvedCommand => {
        const next = [...resolved.args];

        next.splice(position, 0, flag);

        return { ...resolved, args: next };
    };

    switch (pm) {
        case "aube":
        case "pnpm": {
            // pnpm dlx accepts --offline (skip network, fail if not in store).
            // aube has no dlx-specific offline flag but accepts --offline on
            // its install path; pass through so the user sees their intent.
            return insertAt("--offline", 1);
        }
        case "bun": {
            return {
                ...resolved,
                warnings: [
                    ...resolved.warnings,
                    "bun x does not support --offline. Pre-install the package via `vis install` so bun x resolves from the local cache.",
                ],
            };
        }
        case "deno": {
            // deno run takes --cached-only. Insert after `run` and before
            // `-A` to keep the flag list in flag-before-spec order.
            return insertAt("--cached-only", 1);
        }
        case "npm": {
            // npm exec --offline. Insert at 1 (after `exec`); `--yes` and
            // `--package=…` flags follow.
            return insertAt("--offline", 1);
        }
        case "yarn": {
            if (version.startsWith("1.")) {
                // yarn classic falls back to npx (see resolve_dlx in the
                // Rust resolver). npx supports --offline.
                return insertAt("--offline", 0);
            }

            return {
                ...resolved,
                warnings: [
                    ...resolved.warnings,
                    "yarn berry has no --offline flag for dlx. Configure `enableNetwork: false` in .yarnrc.yml or set `enableMirror: true` for offline-first behavior.",
                ],
            };
        }
        default: {
            const exhaustive: never = pm;

            return { ...resolved, warnings: [...resolved.warnings, `applyDlxOffline: unsupported pm ${String(exhaustive)}`] };
        }
    }
};

const runDlx = (pm: InstallerInfo, options: DlxOptions, cwd: string, logger: Console, extras: RunDlxExtras = {}): number => {
    let resolved = pm.name === "aube" ? resolveAubeDlx(options) : resolveDlx(pm.name, pm.version, options);

    if (extras.offline) {
        resolved = applyDlxOffline(resolved, pm.name, pm.version);
    }

    return runResolved(pm, resolved, cwd, logger, { dry: extras.dry, env: extras.env });
};

const runExec = (pm: InstallerInfo, options: ExecOptions, cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubeExec(options), cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolveExec(pm.name, pm.version, options), cwd, logger, extras);
};

const runPmSubcommand = (pm: InstallerInfo, subcommand: string, args: string[], cwd: string, logger: Console, extras: RunOverrides = {}): number => {
    if (pm.name === "aube") {
        return runResolved(pm, resolveAubePmCommand(subcommand, args), cwd, logger, extras);
    }

    // Cross-PM differences the native resolver doesn't model: pnpm 11
    // removals (whoami/owner/ping/search/token), yarn berry's `yarn npm`
    // namespace, bun's `bun pm` namespace, and subcommands that have no
    // analogue on a given PM (e.g. `plugin` on npm).
    const action = dispatchSubcommand(pm, subcommand, args);

    if (action.kind === "skip") {
        logger.warn(`warning: ${action.warning}`);

        return 0;
    }

    if (action.kind === "rewrite") {
        return runResolved(pm, { args: action.args, bin: action.bin, warnings: action.warning ? [action.warning] : [] }, cwd, logger, extras);
    }

    return resolveAndRun(pm, () => resolvePmCommand(pm.name, pm.version, subcommand, args), cwd, logger, extras);
};

export type { CorepackMode, InfoOptions, InstallBackend, InstallerInfo, PmInfo, RunAddExtras, RunDlxExtras, RunInstallExtras, RunOverrides, RunRemoveExtras };
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

/**
 * Internal helpers exposed for unit testing. Not part of the public
 * API — do not import from anywhere outside `__tests__`. Subject to
 * removal without a deprecation cycle.
 */
export const pmRunnerInternals = {
    applyCorepack,
    applyDlxOffline,
    applyDryRun,
    applyImmutableCache,
    applySilent,
    shouldUseCorepack,
    spawnResolved,
};
