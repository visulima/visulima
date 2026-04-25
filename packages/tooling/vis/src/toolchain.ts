/**
 * Toolchain detection + delegation. `vis toolchain` never installs Node
 * itself — it detects whichever version manager the developer already has
 * (proto, mise, fnm, volta, asdf, nvm) and shells out to it. When nothing
 * is installed, it reports what the user needs to pin and suggests a
 * manager to install.
 *
 * Compared to vite+ (which ships its own managed runtime under ~/.vite-plus),
 * vis delegates so users stay in the ecosystem they already know. That
 * keeps vis's binary small and avoids a parallel ~/.vis-plus directory.
 */
import { execFileSync } from "node:child_process";
import { renameSync, unlinkSync, writeFileSync as fsWriteFileSync } from "node:fs";
import { delimiter, sep } from "node:path";

import { isAccessibleSync, readFileSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

/**
 * Managers vis can auto-detect and delegate to. Kept as a single source
 * of truth so error messages and docs don't drift out of sync with the
 * code.
 */
export const SUPPORTED_MANAGERS = ["proto", "mise", "fnm", "volta", "asdf", "nvm", "corepack"] as const;

export type VersionManagerName = "asdf" | "corepack" | "fnm" | "mise" | "none" | "nvm" | "proto" | "self-activate" | "volta";

export type RuntimeTool = "bun" | "deno" | "go" | "node" | "npm" | "pnpm" | "python" | "ruby" | "rust" | "yarn";

/**
 * Where an expected version came from, in priority order. Higher-indexed
 * sources win when the same tool is pinned in multiple places.
 */
export type PinSource =
    | ".mise.toml"
    | ".node-version"
    | ".nvmrc"
    | ".prototools"
    | ".tool-versions"
    | "engines"
    | "packageManager"
    | "vis.config.ts"
    | "volta";

export interface ToolSpec {
    readonly source: PinSource;
    readonly tool: RuntimeTool;
    readonly version: string;
}

export interface DetectedManager {
    /** Detected binary path (when the manager was found in PATH). */
    readonly binPath?: string;
    /** Workspace-local config files that belong to this manager. */
    readonly configFiles: readonly string[];
    /** `true` if the manager binary is available in PATH. */
    readonly installed: boolean;
    readonly name: VersionManagerName;
    /** `manager --version` output, when obtainable. Not cached across runs. */
    readonly version?: string;
}

export interface ToolchainConfig {
    /**
     * When a tool pin doesn't match the running version, try to fix it
     * automatically before `vis run` / `vis ci` proceed. Defaults to
     * `true` when {@link findInstalledManagers} reports at least one
     * installed manager, `false` otherwise.
     *
     * Set to `false` to keep the doctor-style warning behaviour and
     * make users run `vis toolchain install` themselves.
     */
    readonly autoInstall?: boolean;

    /** Explicit manager override, useful in CI. */
    readonly preferredManager?: VersionManagerName;
    /** Overrides for engines/packageManager-derived pins. */
    readonly tools?: Partial<Record<RuntimeTool, string>>;
}

/**
 * Which manager is responsible for a given tool, and whether we can act
 * on it right now. `self-activate` means the PM binary itself (pnpm 10+,
 * yarn berry) will switch on next invocation from the `packageManager`
 * field — no external manager needed.
 */
export interface ResolvedManager {
    readonly installed: boolean;
    readonly name: VersionManagerName;
    /** Human-readable reason when installed === false (e.g. "not on PATH"). */
    readonly note?: string;
}

export interface ToolStatus {
    /** What is actually running in this process (node) or on PATH (others). */
    readonly actual?: string;
    readonly expected: ToolSpec;
    /** Which manager vis would delegate to for this specific tool. */
    readonly manager: ResolvedManager;
    /** `true` when `actual` satisfies `expected.version`. */
    readonly matches: boolean;
}

export interface ToolchainStatus {
    /** Every manager we found (installed or referenced by config). */
    readonly detected: readonly DetectedManager[];
    readonly tools: readonly ToolStatus[];
}

// ── Manager detection ───────────────────────────────────────────────

/**
 * Managers we try to auto-detect. `self-activate` isn't detected — it's
 * the pnpm/yarn binary handling `packageManager` itself, so it appears
 * only as a per-tool resolution, never as a workspace-level manager.
 */
type DetectableManager = Exclude<VersionManagerName, "none" | "self-activate">;

/**
 * Tools each manager is capable of installing. Drives per-tool
 * resolution in {@link resolveManagerFor}. Corepack is scoped to pnpm/
 * yarn/npm; fnm / nvm are Node-only; volta is Node + JS package managers;
 * proto / mise / asdf are catch-all.
 */
const MANAGER_CAPABILITIES: Record<DetectableManager, readonly RuntimeTool[]> = {
    // npm / pnpm / yarn are available via community asdf plugins; users
    // who haven't installed those plugins won't have asdf reach for
    // them in resolveManagerFor (the manager just won't have a config
    // file referencing them), so listing them here is safe and matches
    // the "asdf is catch-all" docstring above.
    asdf: ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"],
    corepack: ["npm", "pnpm", "yarn"],
    fnm: ["node"],
    mise: ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"],
    nvm: ["node"],
    proto: ["bun", "deno", "go", "node", "npm", "pnpm", "python", "ruby", "rust", "yarn"],
    volta: ["node", "npm", "pnpm", "yarn"],
};

const MANAGER_ORDER: readonly DetectableManager[] = ["proto", "mise", "fnm", "volta", "asdf", "nvm", "corepack"];

const MANAGER_CONFIG_FILES: Record<DetectableManager, readonly string[]> = {
    asdf: [".tool-versions"],
    // Corepack's config is the `packageManager` field in package.json; we
    // detect that separately in `corepackConfigFiles`.
    corepack: [] as const,
    fnm: [".nvmrc", ".node-version"],
    mise: [".mise.toml", ".config/mise.toml", "mise.toml"],
    nvm: [".nvmrc"],
    proto: [".prototools"],
    volta: [] as const,
};

/**
 * Per-process memoisation for {@link isOnPath} results. PATH lookups
 * end up running 30-50 times per `vis toolchain status` invocation
 * (every manager probe + every tool resolution), and stat'ing the
 * cartesian product of PATH × PATHEXT is the bottleneck. Cleared by
 * {@link clearToolchainCache}.
 */
const onPathCache = new Map<string, string | undefined>();

/**
 * Reads `PATH` and returns the resolved absolute path for `binary` if
 * any entry on PATH contains it (with or without one of the PATHEXT
 * extensions on Windows). Cheaper than spawning `which` because we
 * only stat candidate paths.
 *
 * On Windows we test the bare name first (so binaries like a git-bash
 * or Cygwin `node` with no extension still resolve), then iterate
 * PATHEXT. Surrounding single/double quotes on a PATH entry are
 * stripped — Windows installers occasionally emit `PATH="C:\Tools\..."`
 * which strict string-match would skip.
 *
 * Exported for testing; most callers use {@link findInstalledManagers}
 * or {@link resolveToolBinary} instead.
 */
export const isOnPath = (binary: string): string | undefined => {
    const cached = onPathCache.get(binary);

    if (cached !== undefined || onPathCache.has(binary)) {
        return cached;
    }

    const pathEnv = process.env["PATH"];

    if (!pathEnv) {
        onPathCache.set(binary, undefined);

        return undefined;
    }

    const isWindows = process.platform === "win32";
    // "" first so a bare-name binary is found before trying PATHEXT
    // suffixes — matters on Windows where Cygwin / git-bash drop
    // extensions from POSIX-y binaries.
    const exts = isWindows ? ["", ...(process.env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""];

    for (const rawDir of pathEnv.split(delimiter)) {
        // Strip surrounding quotes some installers leave behind, and
        // skip empty segments produced by leading/trailing delimiters.
        const dir = rawDir.replace(/^["']|["']$/g, "").trim();

        if (dir === "") {
            continue;
        }

        for (const ext of exts) {
            const candidate = `${dir}${sep}${binary}${ext}`;

            if (isAccessibleSync(candidate)) {
                onPathCache.set(binary, candidate);

                return candidate;
            }
        }
    }

    onPathCache.set(binary, undefined);

    return undefined;
};

/**
 * Asks `<binary> --version` for its version string. Returns undefined
 * when the binary doesn't exist, exits non-zero, or prints something
 * unparseable. Runs with a short timeout so a wedged binary cannot
 * stall `vis run`.
 */
const queryManagerVersion = (binary: string, args: readonly string[] = ["--version"]): string | undefined => {
    try {
        const output = execFileSync(binary, args as string[], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
        });

        const match = /\d+\.\d+(\.\d+)?/.exec(output);

        return match ? match[0] : output.trim() || undefined;
    } catch {
        return undefined;
    }
};

/**
 * Volta and corepack both read package.json instead of a sidecar config
 * file. Volta looks at `volta.<tool>`; corepack looks at `packageManager`.
 */
const pkgFieldConfigFiles = (workspaceRoot: string, field: "packageManager" | "volta"): readonly string[] => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return [];
    }

    try {
        const pkg = readJsonSync(pkgPath) as Record<string, unknown>;
        const value = pkg[field];

        if (field === "volta" && typeof value === "object" && value !== null && Object.keys(value as Record<string, unknown>).length > 0) {
            return ["package.json"];
        }

        if (field === "packageManager" && typeof value === "string" && value.length > 0) {
            return ["package.json"];
        }
    } catch {
        // ignore
    }

    return [];
};

/**
 * Walks the configured manager order and records which ones are (a)
 * installed and (b) have workspace-local config files.
 */
const configFilesFor = (name: DetectableManager, workspaceRoot: string): readonly string[] => {
    if (name === "volta") {
        return pkgFieldConfigFiles(workspaceRoot, "volta");
    }

    if (name === "corepack") {
        return pkgFieldConfigFiles(workspaceRoot, "packageManager");
    }

    return MANAGER_CONFIG_FILES[name].filter((file) => isAccessibleSync(join(workspaceRoot, file)));
};

/**
 * Cache keyed by workspace root. Each detection runs `isOnPath` 7× and
 * spawns up to 7 `--version` subprocesses (each with a 2s timeout), so
 * repeating the work within a single vis invocation adds noticeable
 * latency — especially to `status`, which calls
 * `getToolchainStatus` + `resolveManagerFor` + `executeDetect`.
 *
 * The cache lives for the lifetime of the process. Callers that need a
 * fresh scan (e.g. a future `--refresh` flag, or tests that mutate PATH
 * between calls on the same workspace root) can pass
 * `{ refresh: true }` or call {@link clearToolchainCache}.
 */
const detectionCache = new Map<string, readonly DetectedManager[]>();

/** Clears the memoised detection cache. Useful in tests. */
export const clearToolchainCache = (): void => {
    detectionCache.clear();
    onPathCache.clear();
};

/**
 * Walks {@link MANAGER_ORDER} and returns every manager that's either
 * installed (binary on PATH or shell function present) or referenced
 * by a workspace-local config file. Memoised per `workspaceRoot`;
 * pass `{ refresh: true }` to force a fresh scan, or call
 * {@link clearToolchainCache} between invocations.
 * @param workspaceRoot Absolute path to the workspace root.
 * @param options       `{ refresh: true }` skips the cache.
 */
export const findInstalledManagers = (workspaceRoot: string, options?: { refresh?: boolean }): readonly DetectedManager[] => {
    if (!options?.refresh) {
        const cached = detectionCache.get(workspaceRoot);

        if (cached) {
            return cached;
        }
    }

    const results: DetectedManager[] = [];
    // pnpm / yarn self-activate from the `packageManager` field, so if
    // either binary is on PATH we don't need corepack to satisfy that
    // pin. Used below to decide whether listing corepack as "missing"
    // is actionable or just noise.
    const pnpmOrYarnOnPath = Boolean(isOnPath("pnpm")) || Boolean(isOnPath("yarn"));

    for (const name of MANAGER_ORDER) {
        const binary = name === "nvm" ? undefined : isOnPath(name);
        // nvm is a shell function, not a real binary — treat it as
        // installed when $NVM_DIR exists.
        const nvmInstalled = name === "nvm" && Boolean(process.env["NVM_DIR"]);

        const configFiles = configFilesFor(name, workspaceRoot);
        const installed = Boolean(binary) || nvmInstalled;

        // Corepack's "config file" is a `packageManager` field in
        // package.json — which virtually every modern pnpm/yarn
        // workspace has. Listing it as a detected manager just because
        // that field exists produces noisy "corepack — referenced but
        // not installed" warnings on workspaces that don't actually
        // use corepack (pnpm 10+ self-activates).
        //
        // Surface corepack when:
        //   (a) the binary is genuinely on PATH, OR
        //   (b) `packageManager` is pinned AND self-activate can't help
        //       — i.e. no pnpm/yarn binary is installed yet, so the
        //       user needs corepack (or a manual install) to resolve it.
        //
        // Case (b) is the "CI container with only Node" scenario where
        // corepack really is the missing piece.
        if (name === "corepack" && !installed) {
            const hasPackageManagerPin = configFiles.length > 0;

            if (!hasPackageManagerPin || pnpmOrYarnOnPath) {
                continue;
            }
        }

        if (!installed && configFiles.length === 0) {
            continue;
        }

        results.push({
            binPath: binary,
            configFiles,
            installed,
            name,
            version: binary ? queryManagerVersion(binary) : undefined,
        });
    }

    const frozen = Object.freeze(results);

    detectionCache.set(workspaceRoot, frozen);

    return frozen;
};

/**
 * Picks the "primary" manager for the workspace — the one `vis toolchain
 * detect` names and the one used as a display hint in the status view.
 * Priority:
 *
 *   1. `config.preferredManager` (explicit user override). Reported as
 *      `installed: false` when the named manager isn't on PATH.
 *   2. First detected manager that is installed AND has a workspace-local
 *      config file.
 *   3. First installed manager — even without a local config file.
 *   4. First manager referenced by a local config file, installed or not
 *      (so we can still point the user at an installer).
 *   5. `{ name: "none", ... }` — nothing recognised.
 *
 * For per-tool delegation use {@link resolveManagerFor}; this helper is
 * only useful when the CLI needs a single name to show.
 */
export const pickPrimaryManager = (
    workspaceRoot: string,
    config?: ToolchainConfig,
    detected?: readonly DetectedManager[],
): DetectedManager => {
    const found = detected ?? findInstalledManagers(workspaceRoot);

    if (config?.preferredManager && config.preferredManager !== "none") {
        return (
            found.find((d) => d.name === config.preferredManager)
            ?? { configFiles: [], installed: false, name: config.preferredManager }
        );
    }

    return (
        found.find((d) => d.installed && d.configFiles.length > 0)
        ?? found.find((d) => d.installed)
        ?? found.find((d) => d.configFiles.length > 0)
        ?? { configFiles: [], installed: false, name: "none" }
    );
};

// ── Pin discovery ───────────────────────────────────────────────────

interface RootPackageJson {
    engines?: Partial<Record<RuntimeTool, string>>;
    packageManager?: string;
    volta?: Partial<Record<RuntimeTool, string>>;
}

/**
 * Reads `.nvmrc` / `.node-version` at the workspace root.
 */
const readVersionFile = (workspaceRoot: string, names: readonly string[]): { name: string; value: string } | undefined => {
    for (const name of names) {
        const path = join(workspaceRoot, name);

        if (!isAccessibleSync(path)) {
            continue;
        }

        try {
            const content = readFileSync(path).trim();

            if (content !== "") {
                return { name, value: content.replace(/^v/, "") };
            }
        } catch {
            // ignore
        }
    }

    return undefined;
};

const PROTO_LINE_RE = /^([a-z][\w-]*)\s*=\s*"?([^"\n#]+?)"?\s*(?:#.*)?$/i;

/**
 * Parses `.prototools` (TOML-ish key/value). We don't pull in a TOML
 * parser — the subset proto uses is simple enough to recognise with a
 * regex per line. Only top-level keys are honoured; sections are
 * skipped.
 */
const parsePrototools = (workspaceRoot: string): ToolSpec[] => {
    const path = join(workspaceRoot, ".prototools");

    if (!isAccessibleSync(path)) {
        return [];
    }

    const content = readFileSync(path);
    const specs: ToolSpec[] = [];
    let inSection = false;

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        if (line.startsWith("[")) {
            inSection = true;
            continue;
        }

        if (inSection) {
            continue;
        }

        const match = PROTO_LINE_RE.exec(line);

        if (!match) {
            continue;
        }

        const [, rawTool, version] = match;

        const normalizedTool = normalizeToolName(rawTool!);

        if (normalizedTool) {
            specs.push({ source: ".prototools", tool: normalizedTool, version: version!.trim() });
        }
    }

    return specs;
};

const MISE_TOOL_HEADER_RE = /^\[tools\]\s*$/i;
const MISE_LINE_RE = /^([a-z][\w-]*)\s*=\s*"?([^"\n#]+?)"?\s*(?:#.*)?$/i;

/**
 * Parses the `[tools]` section of `.mise.toml`. Same "no TOML parser"
 * trade-off as `parsePrototools` — mise tool pins are strings.
 */
const parseMiseToml = (workspaceRoot: string): ToolSpec[] => {
    for (const candidate of MANAGER_CONFIG_FILES.mise) {
        const path = join(workspaceRoot, candidate);

        if (!isAccessibleSync(path)) {
            continue;
        }

        const specs: ToolSpec[] = [];
        const content = readFileSync(path);
        let inToolsSection = false;

        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();

            if (line === "" || line.startsWith("#")) {
                continue;
            }

            if (line.startsWith("[")) {
                inToolsSection = MISE_TOOL_HEADER_RE.test(line);
                continue;
            }

            if (!inToolsSection) {
                continue;
            }

            const match = MISE_LINE_RE.exec(line);

            if (!match) {
                continue;
            }

            const [, rawTool, version] = match;
            const normalizedTool = normalizeToolName(rawTool!);

            if (normalizedTool) {
                specs.push({ source: ".mise.toml", tool: normalizedTool, version: version!.trim() });
            }
        }

        if (specs.length > 0) {
            return specs;
        }
    }

    return [];
};

/**
 * Parses `.tool-versions` (asdf / rtx / mise compat). One line per tool.
 */
const parseToolVersions = (workspaceRoot: string): ToolSpec[] => {
    const path = join(workspaceRoot, ".tool-versions");

    if (!isAccessibleSync(path)) {
        return [];
    }

    const content = readFileSync(path);
    const specs: ToolSpec[] = [];

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        const parts = line.split(/\s+/);

        if (parts.length < 2) {
            continue;
        }

        const [rawTool, ...versions] = parts;
        const normalizedTool = normalizeToolName(rawTool!);

        if (normalizedTool && versions[0]) {
            specs.push({ source: ".tool-versions", tool: normalizedTool, version: versions[0] });
        }
    }

    return specs;
};

/**
 * Tools we know how to track. Accepts common aliases (`nodejs` → `node`).
 */
const normalizeToolName = (raw: string): RuntimeTool | undefined => {
    const lower = raw.toLowerCase();

    switch (lower) {
        case "bun": {
            return "bun";
        }
        case "deno": {
            return "deno";
        }
        case "go":
        case "golang": {
            return "go";
        }
        case "node":
        case "nodejs": {
            return "node";
        }
        case "npm": {
            return "npm";
        }
        case "pnpm": {
            return "pnpm";
        }
        case "python":
        case "python3": {
            return "python";
        }
        case "ruby": {
            return "ruby";
        }
        case "rust":
        case "rustc": {
            return "rust";
        }
        case "yarn": {
            return "yarn";
        }
        default: {
            return undefined;
        }
    }
};

/**
 * Parses a `packageManager` string from package.json. Strips any
 * SHA checksum (`pnpm@10.0.0+sha...`).
 */
const parsePackageManagerField = (field: string): ToolSpec | undefined => {
    const [nameAndVersion] = field.split("+", 1);
    const match = /^(pnpm|yarn|npm|bun)@(.+)$/.exec(nameAndVersion ?? "");

    if (!match) {
        return undefined;
    }

    const normalizedTool = normalizeToolName(match[1]!);

    if (!normalizedTool) {
        return undefined;
    }

    return { source: "packageManager", tool: normalizedTool, version: match[2]! };
};

/**
 * Collects every tool pin vis can find, merged by source priority.
 * Later sources overwrite earlier ones so `vis.config.ts` wins over
 * `.nvmrc` which wins over `engines.node`.
 */
export const parseExpectedTools = (workspaceRoot: string, config?: ToolchainConfig): readonly ToolSpec[] => {
    const merged = new Map<RuntimeTool, ToolSpec>();
    const add = (spec: ToolSpec): void => {
        merged.set(spec.tool, spec);
    };

    const pkgPath = join(workspaceRoot, "package.json");
    let rootPkg: RootPackageJson = {};

    try {
        if (isAccessibleSync(pkgPath)) {
            rootPkg = readJsonSync(pkgPath) as RootPackageJson;
        }
    } catch {
        // ignore
    }

    if (rootPkg.engines) {
        for (const [rawTool, version] of Object.entries(rootPkg.engines)) {
            const normalizedTool = normalizeToolName(rawTool);

            if (normalizedTool && typeof version === "string") {
                add({ source: "engines", tool: normalizedTool, version });
            }
        }
    }

    if (rootPkg.packageManager) {
        const pmSpec = parsePackageManagerField(rootPkg.packageManager);

        if (pmSpec) {
            add(pmSpec);
        }
    }

    if (rootPkg.volta) {
        for (const [rawTool, version] of Object.entries(rootPkg.volta)) {
            const normalizedTool = normalizeToolName(rawTool);

            if (normalizedTool && typeof version === "string") {
                add({ source: "volta", tool: normalizedTool, version });
            }
        }
    }

    const nodeFile = readVersionFile(workspaceRoot, [".nvmrc", ".node-version"]);

    if (nodeFile) {
        add({
            source: nodeFile.name === ".nvmrc" ? ".nvmrc" : ".node-version",
            tool: "node",
            version: nodeFile.value,
        });
    }

    for (const spec of parseToolVersions(workspaceRoot)) {
        add(spec);
    }

    for (const spec of parseMiseToml(workspaceRoot)) {
        add(spec);
    }

    for (const spec of parsePrototools(workspaceRoot)) {
        add(spec);
    }

    if (config?.tools) {
        for (const [rawTool, version] of Object.entries(config.tools)) {
            const normalizedTool = normalizeToolName(rawTool);

            if (normalizedTool && typeof version === "string") {
                add({ source: "vis.config.ts", tool: normalizedTool, version });
            }
        }
    }

    return [...merged.values()];
};

// ── Status ──────────────────────────────────────────────────────────

/**
 * Per-tool lookup for `<tool> --version`-style queries. Most tools
 * follow the `<tool> --version` convention, but a few don't:
 *
 *   - `go` uses `go version` (no `--version`).
 *   - `rust` is queried via the `rustc` binary (since the source
 *     pin name is the language, not the compiler binary).
 *   - `python` is `python --version` on most systems but `python3`
 *     on others — try both before giving up.
 */
const TOOL_VERSION_QUERY: Record<RuntimeTool, { args: readonly string[]; binaries: readonly string[] }> = {
    bun: { args: ["--version"], binaries: ["bun"] },
    deno: { args: ["--version"], binaries: ["deno"] },
    go: { args: ["version"], binaries: ["go"] },
    node: { args: ["--version"], binaries: ["node"] },
    npm: { args: ["--version"], binaries: ["npm"] },
    pnpm: { args: ["--version"], binaries: ["pnpm"] },
    python: { args: ["--version"], binaries: ["python", "python3"] },
    ruby: { args: ["--version"], binaries: ["ruby"] },
    rust: { args: ["--version"], binaries: ["rustc"] },
    yarn: { args: ["--version"], binaries: ["yarn"] },
};

/**
 * Returns the version of a runtime tool on PATH. For `node` we prefer
 * `node --version` via the PATH-resolved binary over
 * `process.versions.node` — after a user runs `vis toolchain install`,
 * the shim may point at a newer Node than the one vis itself is running
 * on, and the status report should reflect what *subsequent* shell
 * invocations will see. `process.versions.node` is only the fallback
 * when there's no `node` on PATH (rare; vis needs one to have booted).
 */
const queryToolVersion = (tool: RuntimeTool): string | undefined => {
    const lookup = TOOL_VERSION_QUERY[tool];

    for (const candidate of lookup.binaries) {
        const binary = isOnPath(candidate);

        if (binary) {
            return queryManagerVersion(binary, lookup.args);
        }
    }

    if (tool === "node") {
        return process.versions.node;
    }

    return undefined;
};

/**
 * Minimal semver/range compare. We re-use the same subset as
 * `runtime-check.ts` — this is NOT a full semver implementation. Unknown
 * range shapes return `true` so we don't spam warnings.
 */
export const satisfies = (actual: string, range: string): boolean => {
    const normalized = range.trim();

    if (normalized === "" || normalized === "*" || normalized === "latest") {
        return true;
    }

    // Pure exact match ("10.32.1")
    if (/^\d[\d.]*$/.test(normalized)) {
        return actual === normalized || actual.startsWith(`${normalized}.`);
    }

    const parse = (version: string): number[] => version.split(/[.\-+]/).map((part) => Number.parseInt(part, 10) || 0);
    const compare = (a: string, b: string): number => {
        const aParts = parse(a);
        const bParts = parse(b);
        const len = Math.max(aParts.length, bParts.length);

        for (let index = 0; index < len; index++) {
            const ai = aParts[index] ?? 0;
            const bi = bParts[index] ?? 0;

            if (ai !== bi) {
                return ai - bi;
            }
        }

        return 0;
    };

    for (const clause of normalized.split(/\s+/).filter(Boolean)) {
        if (clause.startsWith(">=")) {
            if (compare(actual, clause.slice(2).trim()) < 0) {
                return false;
            }
        } else if (clause.startsWith("<=")) {
            if (compare(actual, clause.slice(2).trim()) > 0) {
                return false;
            }
        } else if (clause.startsWith(">")) {
            if (compare(actual, clause.slice(1).trim()) <= 0) {
                return false;
            }
        } else if (clause.startsWith("<")) {
            if (compare(actual, clause.slice(1).trim()) >= 0) {
                return false;
            }
        } else if (clause.startsWith("^") || clause.startsWith("~")) {
            const target = clause.slice(1).trim();
            const [targetMajor, targetMinor] = parse(target);
            const [actualMajor, actualMinor] = parse(actual);

            if (actualMajor !== targetMajor) {
                return false;
            }

            if (clause.startsWith("~") && actualMinor !== targetMinor) {
                return false;
            }

            if (compare(actual, target) < 0) {
                return false;
            }
        }
    }

    return true;
};

/**
 * Which managers, in preferred order, could satisfy a pin from the given
 * source. Drives {@link resolveManagerFor}. The source tells us a lot
 * about intent — e.g. a `.prototools` entry means the user wants proto,
 * a `packageManager` field for pnpm/yarn means "let the PM self-activate"
 * first.
 */
const preferenceFor = (source: PinSource, tool: RuntimeTool): readonly VersionManagerName[] => {
    switch (source) {
        case ".mise.toml": {
            return ["mise"];
        }
        case ".node-version":
        case ".nvmrc": {
            return ["fnm", "nvm", "volta", "proto", "mise", "asdf"];
        }
        case ".prototools": {
            return ["proto"];
        }
        case ".tool-versions": {
            // mise reads asdf-format .tool-versions too.
            return ["asdf", "mise"];
        }
        case "packageManager": {
            if (tool === "pnpm" || tool === "yarn") {
                // pnpm 10+ and yarn berry self-activate from this field.
                return ["self-activate", "volta", "proto", "mise", "corepack"];
            }

            if (tool === "npm") {
                return ["volta", "proto", "mise", "asdf", "corepack"];
            }

            if (tool === "bun") {
                return ["proto", "mise", "asdf"];
            }

            return ["volta", "proto", "mise"];
        }
        case "volta": {
            return ["volta"];
        }
        case "engines":
        case "vis.config.ts":
        default: {
            // Catch-all pins — walk every capable manager.
            return ["proto", "mise", "fnm", "volta", "asdf", "nvm", "corepack"];
        }
    }
};

/**
 * Picks the manager vis should delegate to for a specific tool pin.
 * Walks `preferenceFor(source, tool)` and returns the first candidate
 * that is installed AND capable. Falls back to the first capable
 * manager (installed or not) so the status report can still name
 * something. Returns `{ name: "none" }` when truly nothing can help.
 */
export const resolveManagerFor = (
    spec: ToolSpec,
    detected: readonly DetectedManager[],
    config?: ToolchainConfig,
): ResolvedManager => {
    if (config?.preferredManager && config.preferredManager !== "none") {
        if (canHandle(config.preferredManager, spec.tool)) {
            const override = detected.find((d) => d.name === config.preferredManager);

            // If the user pinned a preferred manager but it isn't on
            // PATH yet, surface a synthetic uninstalled entry so status
            // reports `→ <preferredManager> (missing)` instead of
            // silently falling through to the auto-pick. Mirrors the
            // contract of `pickPrimaryManager`.
            return override
                ? { installed: override.installed, name: override.name }
                : {
                    installed: false,
                    name: config.preferredManager,
                    note: `${config.preferredManager} is the preferred manager but isn't on PATH`,
                };
        }
    }

    const preference = preferenceFor(spec.source, spec.tool);

    for (const name of preference) {
        if (name === "self-activate") {
            // Only meaningful for pnpm/yarn when PM binary is installed.
            if ((spec.tool === "pnpm" || spec.tool === "yarn") && isOnPath(spec.tool)) {
                return {
                    installed: true,
                    name: "self-activate",
                    note: `${spec.tool} will activate ${spec.version} from the packageManager field on next invocation`,
                };
            }

            continue;
        }

        if (!canHandle(name, spec.tool)) {
            continue;
        }

        const match = detected.find((d) => d.name === name);

        if (match?.installed) {
            return { installed: true, name };
        }
    }

    // Fallback: first capable manager, even if uninstalled, so we can at
    // least suggest it.
    for (const name of preference) {
        if (name === "self-activate" || !canHandle(name, spec.tool)) {
            continue;
        }

        return { installed: false, name, note: `${name} can install ${spec.tool} — run \`vis toolchain install\` after adding it to PATH` };
    }

    return { installed: false, name: "none", note: "No manager knows how to install this tool" };
};

const canHandle = (name: VersionManagerName, tool: RuntimeTool): boolean => {
    if (name === "none") {
        return false;
    }

    if (name === "self-activate") {
        return tool === "pnpm" || tool === "yarn";
    }

    return MANAGER_CAPABILITIES[name].includes(tool);
};

/**
 * Cross-references every workspace tool pin (engines, packageManager,
 * .nvmrc, .prototools, .mise.toml, .tool-versions, volta field,
 * vis.config.ts) against the actual versions on PATH and the
 * available managers. Drives `vis toolchain status`.
 * @param workspaceRoot Absolute path to the workspace root.
 * @param config        Resolved toolchain section of vis.config.ts.
 * @returns A {@link ToolchainStatus} with detected managers and a
 *          per-tool list with each tool's actual / expected versions
 *          and the manager vis would delegate to for `install` / `use`.
 */
export const getToolchainStatus = (workspaceRoot: string, config?: ToolchainConfig): ToolchainStatus => {
    const detected = findInstalledManagers(workspaceRoot);
    const expectedTools = parseExpectedTools(workspaceRoot, config);

    const tools: ToolStatus[] = expectedTools.map((expected) => {
        const actual = queryToolVersion(expected.tool);
        const matches = actual !== undefined && satisfies(actual, expected.version);
        const manager = resolveManagerFor(expected, detected, config);

        return { actual, expected, manager, matches };
    });

    return { detected, tools };
};

// ── Install / use commands ──────────────────────────────────────────

export interface InstallInvocation {
    readonly args: readonly string[];
    readonly bin: string;
    readonly hint?: string;
}

/**
 * Translates a tool pin into a `<manager> install` invocation. `nvm` is
 * a shell function, so we emit a hint instead of a runnable command.
 * Returns `undefined` when we have no mapping for that manager/tool.
 */
export const buildInstallInvocation = (manager: VersionManagerName, spec?: ToolSpec): InstallInvocation | undefined => {
    switch (manager) {
        case "asdf": {
            return { args: ["install"], bin: "asdf" };
        }
        case "corepack": {
            if (!spec) {
                // `corepack install` (no args) is corepack 0.22+ (Node
                // 20.7+). Use `prepare --activate` which is universal
                // and behaves the same — reads packageManager and
                // activates the resolved version.
                return { args: ["prepare", "--activate"], bin: "corepack", hint: "reads the packageManager field in package.json" };
            }

            // For an explicit pin we prepare+activate so the shim works
            // immediately.
            return {
                args: ["prepare", `${spec.tool}@${spec.version}`, "--activate"],
                bin: "corepack",
            };
        }
        case "fnm": {
            if (spec && spec.tool === "node") {
                return { args: ["install", spec.version], bin: "fnm" };
            }

            return { args: ["install"], bin: "fnm", hint: "reads .nvmrc / .node-version" };
        }
        case "mise": {
            return { args: ["install"], bin: "mise" };
        }
        case "none": {
            return undefined;
        }
        case "nvm": {
            return {
                args: [],
                bin: "nvm",
                hint: "nvm is a shell function — run `nvm install` / `nvm use` from your shell",
            };
        }
        case "proto": {
            return { args: ["install"], bin: "proto" };
        }
        case "self-activate": {
            // pnpm 10+ / yarn berry activate from the packageManager field
            // on next invocation. There's nothing for vis to run — the
            // next `pnpm <anything>` does the switch. We emit an empty
            // invocation so the caller knows it's a no-op.
            return {
                args: [],
                bin: spec?.tool ?? "pnpm",
                hint: `${spec?.tool ?? "pnpm"} will self-activate on next invocation — no install needed`,
            };
        }
        case "volta": {
            if (!spec) {
                return { args: ["install", "node@lts"], bin: "volta", hint: "volta pins per-tool; specify <tool>@<version>" };
            }

            return { args: ["install", `${spec.tool}@${spec.version}`], bin: "volta" };
        }
        default: {
            const exhaustive: never = manager;

            throw new Error(`Unknown manager: ${exhaustive as string}`);
        }
    }
};

export interface UseInvocation {
    readonly args: readonly string[];
    readonly bin: string;
    readonly configChange?: { file: string; hint: string };
}

/**
 * Translates `vis toolchain use <tool>@<version>` into the manager-
 * native equivalent. Also reports which config file the change will
 * end up in, so the user can commit it.
 */
export const buildUseInvocation = (manager: VersionManagerName, spec: ToolSpec): UseInvocation | undefined => {
    switch (manager) {
        case "asdf": {
            return {
                args: ["local", spec.tool, spec.version],
                bin: "asdf",
                configChange: { file: ".tool-versions", hint: `Pins ${spec.tool} ${spec.version}` },
            };
        }
        case "corepack": {
            if (spec.tool !== "npm" && spec.tool !== "pnpm" && spec.tool !== "yarn") {
                return undefined;
            }

            return {
                args: ["use", `${spec.tool}@${spec.version}`],
                bin: "corepack",
                configChange: { file: "package.json", hint: `Writes packageManager: "${spec.tool}@${spec.version}"` },
            };
        }
        case "fnm": {
            if (spec.tool === "node") {
                return { args: ["use", spec.version], bin: "fnm" };
            }

            return undefined;
        }
        case "mise": {
            return {
                args: ["use", "--", `${spec.tool}@${spec.version}`],
                bin: "mise",
                configChange: { file: ".mise.toml", hint: `Pins ${spec.tool} ${spec.version}` },
            };
        }
        case "none": {
            return undefined;
        }
        case "nvm": {
            if (spec.tool === "node") {
                return {
                    args: [],
                    bin: "nvm",
                    configChange: { file: ".nvmrc", hint: "Write version to .nvmrc manually (nvm doesn't persist)." },
                };
            }

            return undefined;
        }
        case "proto": {
            return {
                args: ["pin", spec.tool, spec.version],
                bin: "proto",
                configChange: { file: ".prototools", hint: `Pins ${spec.tool} ${spec.version}` },
            };
        }
        case "self-activate": {
            // Edit the packageManager field directly — pnpm/yarn pick it
            // up on their next run. Returning an invocation with no args
            // tells the caller to fall back to writing package.json.
            return {
                args: [],
                bin: spec.tool,
                configChange: {
                    file: "package.json",
                    hint: `Set packageManager: "${spec.tool}@${spec.version}" — ${spec.tool} will self-activate on next invocation`,
                },
            };
        }
        case "volta": {
            return {
                args: ["pin", `${spec.tool}@${spec.version}`],
                bin: "volta",
                configChange: { file: "package.json", hint: `Writes volta.${spec.tool}` },
            };
        }
        default: {
            const exhaustive: never = manager;

            throw new Error(`Unknown manager: ${exhaustive as string}`);
        }
    }
};

/**
 * Helper for commands: runs `<manager> which <tool>` when available,
 * returning the resolved binary path. Falls back to PATH lookup.
 */
export const resolveToolBinary = (manager: DetectedManager, tool: RuntimeTool): string | undefined => {
    if (manager.installed && manager.binPath) {
        // proto/mise/asdf expose `which`; volta has `volta which`; fnm
        // prints to stdout from `fnm which`.
        if (manager.name === "proto" || manager.name === "mise" || manager.name === "asdf" || manager.name === "volta" || manager.name === "fnm") {
            try {
                const output = execFileSync(manager.binPath, ["which", tool], {
                    encoding: "utf8",
                    stdio: ["ignore", "pipe", "ignore"],
                    timeout: 2000,
                });

                return output.trim() || undefined;
            } catch {
                // fall through to PATH
            }
        }
    }

    return isOnPath(tool);
};

/**
 * Writes `body` to `path` atomically — write a sibling temp file,
 * fsync the bytes (writeFileSync does this), then rename over the
 * destination. On POSIX rename is atomic, so a concurrent reader
 * always sees either the old body or the new one, never a half-written
 * file. On Windows, rename onto an existing path requires the
 * destination to be writable; that's universally true for files we
 * own (package.json, .nvmrc).
 *
 * Used for `package.json` updates so two `vis toolchain use` runs
 * racing against each other can't produce a corrupted JSON body.
 */
const atomicWrite = (path: string, body: string): void => {
    // Random suffix avoids collisions when the same workspace is
    // touched by parallel vis invocations (rare but possible in CI).
    const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;

    fsWriteFileSync(tmp, body);

    try {
        renameSync(tmp, path);
    } catch (cause: unknown) {
        // Best-effort cleanup. If rename failed, the tmp file is still
        // sitting on disk; if rename succeeded, the unlink is a no-op.
        try {
            unlinkSync(tmp);
        } catch {
            // ignore
        }

        throw cause;
    }
};

/**
 * Inserts `pkg.packageManager` at a stable position when the field
 * doesn't yet exist: before `dependencies` / `devDependencies` if
 * present, otherwise at the end. Reduces noise in code review when
 * vis adds the field for the first time.
 */
const insertPackageManagerKey = (pkg: Record<string, unknown>, value: string): Record<string, unknown> => {
    if ("packageManager" in pkg) {
        // Existing field — keep its position; just update the value.
        pkg.packageManager = value;

        return pkg;
    }

    const ordered: Record<string, unknown> = {};
    let inserted = false;

    for (const [key, fieldValue] of Object.entries(pkg)) {
        if (!inserted && (key === "dependencies" || key === "devDependencies" || key === "peerDependencies" || key === "optionalDependencies")) {
            ordered.packageManager = value;
            inserted = true;
        }

        ordered[key] = fieldValue;
    }

    if (!inserted) {
        ordered.packageManager = value;
    }

    return ordered;
};

/**
 * Writes `<spec.tool>@<spec.version>` into `package.json`'s
 * `packageManager` field. Used by the self-activate path of
 * `vis toolchain use <pnpm|yarn>@<version>` — pnpm 10+ and yarn berry
 * read this field on their next invocation and switch to the pinned
 * version without any external manager.
 *
 * Preserves existing indentation and trailing newline so diffs stay
 * clean. When the field doesn't already exist, inserts it before the
 * dependency-related fields rather than appending at the end.
 *
 * **Strict JSON only**: this function uses `JSON.parse`, so JSONC /
 * JSON5 inputs (comments, trailing commas) will throw. We surface a
 * file-path-prefixed error in that case. If you need format-preserving
 * edits over JSONC, use a structure-preserving editor like
 * `@npmcli/package-json`.
 * @returns the `<pm>@<version>` string that was written, or undefined
 *          if the tool isn't a JS package manager (we refuse to write
 *          non-PM tools into the packageManager field).
 */
export const writePackageManagerField = (workspaceRoot: string, spec: ToolSpec): string | undefined => {
    if (spec.tool !== "pnpm" && spec.tool !== "yarn" && spec.tool !== "npm" && spec.tool !== "bun") {
        return undefined;
    }

    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        throw new Error(`Cannot pin ${spec.tool}: ${pkgPath} does not exist.`);
    }

    const raw = readFileSync(pkgPath);
    const indentMatch = /\n([ \t]+)/.exec(raw);
    // Default to 2 spaces — the JS-ecosystem norm, and what
    // `sort-package-json` / prettier both emit. Only fall back to this
    // when the current file has no detectable indent (e.g. `{}` on one
    // line).
    const indent = indentMatch?.[1] ?? "  ";

    let pkg: Record<string, unknown>;

    try {
        pkg = JSON.parse(raw) as Record<string, unknown>;
    } catch (cause: unknown) {
        // JSON.parse throws SyntaxError with a useless "Unexpected
        // token X at position Y" — prepend the file path and hint so
        // the user can act on it instead of getting a bare stack.
        throw new Error(
            `${pkgPath} is not valid JSON — fix it before running \`vis toolchain use\`. Underlying error: ${(cause as Error).message}`,
        );
    }

    const value = `${spec.tool}@${spec.version}`;
    const updated = insertPackageManagerKey(pkg, value);

    const trailingNewline = raw.endsWith("\n") ? "\n" : "";

    atomicWrite(pkgPath, `${JSON.stringify(updated, undefined, indent)}${trailingNewline}`);

    return value;
};

/**
 * Updates `engines.<tool>` in package.json **only when the field
 * already exists**. The reasoning: if a project never authored an
 * engines field, vis shouldn't add one — it might be intentional for
 * libraries that want to leave the choice to consumers. But if the
 * field is there, keeping it in sync with the manager-specific pin is
 * almost always what the user wants (and it's the only durable pin
 * many CI providers actually check).
 *
 * Returns the new value when an update happened, `undefined` when the
 * field didn't exist (and we left things alone).
 */
export const updateEnginesField = (workspaceRoot: string, spec: ToolSpec): string | undefined => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return undefined;
    }

    const raw = readFileSync(pkgPath);
    let pkg: { engines?: Record<string, string> } & Record<string, unknown>;

    try {
        pkg = JSON.parse(raw) as typeof pkg;
    } catch (cause: unknown) {
        throw new Error(
            `${pkgPath} is not valid JSON — fix it before running \`vis toolchain use\`. Underlying error: ${(cause as Error).message}`,
        );
    }

    if (!pkg.engines || pkg.engines[spec.tool] === undefined) {
        // Don't synthesise an engines field; that's an editorial choice
        // for the project owner.
        return undefined;
    }

    if (pkg.engines[spec.tool] === spec.version) {
        return undefined;
    }

    pkg.engines[spec.tool] = spec.version;

    const indentMatch = /\n([ \t]+)/.exec(raw);
    const indent = indentMatch?.[1] ?? "  ";
    const trailingNewline = raw.endsWith("\n") ? "\n" : "";

    atomicWrite(pkgPath, `${JSON.stringify(pkg, undefined, indent)}${trailingNewline}`);

    return spec.version;
};

/**
 * Parses `<tool>@<version>` as typed in `vis toolchain use node@22.13.0`.
 * Returns `undefined` when the shape is wrong or the tool is unknown.
 */
export const parseUseArgument = (raw: string): ToolSpec | undefined => {
    const match = /^([a-z][\w-]*)@(.+)$/i.exec(raw.trim());

    if (!match) {
        return undefined;
    }

    const normalizedTool = normalizeToolName(match[1]!);

    if (!normalizedTool) {
        return undefined;
    }

    return { source: "vis.config.ts", tool: normalizedTool, version: match[2]! };
};

// ── Auto-install hook (vis run / vis ci pre-flight) ─────────────────

export interface EnsureToolchainResult {
    /** Tools that vis tried to install on the user's behalf. */
    readonly attempted: readonly ToolSpec[];
    /** Tools whose install failed (or was unsupported). Caller decides what to do. */
    readonly failed: readonly { error: string; spec: ToolSpec }[];
    /** True when nothing needed doing — fast path. */
    readonly upToDate: boolean;
}

export interface EnsureToolchainLogger {
    error: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Pre-flight check for `vis run` / `vis ci`. Compares actual vs expected
 * tool versions; if `config.autoInstall` is true (default when a manager
 * is detected) and any pin is unsatisfied, runs the appropriate
 * manager install for each mismatched tool.
 *
 * Returns without error in three cases:
 *   - everything matches
 *   - autoInstall is disabled (caller may still warn separately)
 *   - the install succeeds
 *
 * For shim-based managers (proto, mise, asdf, volta) the new versions
 * are picked up by subsequent subprocess spawns automatically, since
 * the shim binaries on PATH resolve the active version on each call.
 *
 * For fnm/nvm — which require a shell-side activation step — vis can
 * install but cannot transparently switch the current process. We
 * surface a clear hint and continue with the old version rather than
 * blocking.
 */
export const ensureToolchain = async (
    workspaceRoot: string,
    config: ToolchainConfig | undefined,
    logger: EnsureToolchainLogger,
): Promise<EnsureToolchainResult> => {
    const status = getToolchainStatus(workspaceRoot, config);
    const mismatches = status.tools.filter((t) => !t.matches);

    if (mismatches.length === 0) {
        return { attempted: [], failed: [], upToDate: true };
    }

    const hasManager = status.detected.some((d) => d.installed);
    const autoInstall = config?.autoInstall ?? hasManager;

    if (!autoInstall) {
        // Caller (typically `vis run` / `vis ci`) decides whether to
        // surface this as a warning. ensureToolchain stays quiet so it
        // can be a no-op when the user has explicitly opted out.
        return { attempted: [], failed: [], upToDate: false };
    }

    const attempted: ToolSpec[] = [];
    const failed: { error: string; spec: ToolSpec }[] = [];

    // Group mismatches by resolved manager so proto/mise/asdf only run
    // their bulk-install command once.
    const byManager = new Map<VersionManagerName, ToolStatus[]>();

    for (const tool of mismatches) {
        const bucket = byManager.get(tool.manager.name);

        if (bucket) {
            bucket.push(tool);
        } else {
            byManager.set(tool.manager.name, [tool]);
        }
    }

    for (const [managerName, tools] of byManager) {
        // `preferenceFor` only emits `self-activate` for source ===
        // "packageManager", so the field is already set; pnpm/yarn
        // pick it up on next invocation. Nothing to spawn — just log.
        if (managerName === "self-activate") {
            for (const { expected } of tools) {
                logger.info(`toolchain: ${expected.tool} ${expected.version} will self-activate on next ${expected.tool} invocation`);
                attempted.push(expected);
            }

            continue;
        }

        if (managerName === "none") {
            for (const { expected } of tools) {
                failed.push({
                    error: `no manager can install ${expected.tool} — install one of ${SUPPORTED_MANAGERS.join(", ")}`,
                    spec: expected,
                });
            }

            continue;
        }

        const manager = status.detected.find((d) => d.name === managerName);

        if (!manager?.installed) {
            for (const { expected } of tools) {
                failed.push({ error: `${managerName} is not on PATH`, spec: expected });
            }

            continue;
        }

        // proto/mise/asdf/fnm read their own config, one invocation does
        // them all. volta/corepack pin per-tool so we iterate.
        const perTool = managerName === "volta" || managerName === "corepack";
        const invocations = perTool
            ? tools.map((t) => buildInstallInvocation(managerName, t.expected)).filter((inv) => inv !== undefined)
            : [buildInstallInvocation(managerName)].filter((inv) => inv !== undefined);

        for (const invocation of invocations) {
            if (invocation.bin === "nvm" && invocation.args.length === 0) {
                logger.warn("toolchain: nvm requires a shell-side activation. Run `nvm install` / `nvm use` manually.");

                for (const { expected } of tools) {
                    failed.push({ error: "nvm requires shell-side activation", spec: expected });
                }

                continue;
            }

            logger.info(`toolchain: $ ${invocation.bin} ${invocation.args.join(" ")}`);

            try {
                execFileSync(invocation.bin, invocation.args as string[], {
                    cwd: workspaceRoot,
                    stdio: "inherit",
                });

                for (const { expected } of tools) {
                    attempted.push(expected);
                }

                // fnm needs PATH-side activation — even after `fnm
                // install`, the subprocesses we'll spawn next inherit
                // the current PATH and won't see the new version.
                // Eval `fnm env --use-on-cd` and merge into process.env
                // so subsequent task subprocesses pick up the new node.
                if (managerName === "fnm") {
                    activateFnmEnv(invocation.bin, logger);
                }
            } catch (cause: unknown) {
                for (const { expected } of tools) {
                    failed.push({ error: (cause as Error).message, spec: expected });
                }

                break;
            }
        }
    }

    // Drop the cache so the next call re-detects (e.g. corepack just
    // got installed).
    clearToolchainCache();

    return { attempted, failed, upToDate: false };
};

/**
 * Convenience wrapper that `vis run` and `vis ci` both call: invoke
 * {@link ensureToolchain} and surface every failure as a logger.warn
 * line. Always returns; never throws. Skips the call entirely when
 * `skip` is `true` so callers can do
 *
 *     await runToolchainPreflight(workspaceRoot, config, logger, options.skipToolchain);
 *
 * without an extra branch around the call site.
 */
export const runToolchainPreflight = async (
    workspaceRoot: string,
    config: ToolchainConfig | undefined,
    logger: EnsureToolchainLogger,
    skip: boolean = false,
): Promise<void> => {
    if (skip) {
        return;
    }

    const result = await ensureToolchain(workspaceRoot, config, logger);

    for (const failure of result.failed) {
        logger.warn(`toolchain: ${failure.spec.tool} ${failure.spec.version} — ${failure.error}`);
    }
};

/**
 * Eval `fnm env` and merge its PATH/FNM_* exports into `process.env` so
 * subsequent subprocesses (the actual tasks `vis run` will spawn) see
 * the freshly-installed Node. Best-effort — failures are logged and
 * swallowed.
 */
const activateFnmEnv = (fnmBin: string, logger: EnsureToolchainLogger): void => {
    // Pick a shell argument that matches the host so we get parseable
    // output:
    //   - bash:        `export NAME="value"`
    //   - powershell:  `$env:NAME = "value"`
    //   - cmd:         `set "NAME=value"`
    const shell = process.platform === "win32" ? "powershell" : "bash";

    try {
        const output = execFileSync(fnmBin, ["env", "--shell", shell], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
        });

        for (const line of output.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (trimmed === "") {
                continue;
            }

            // PowerShell:  `$env:NAME = "value"`  or  `$env:NAME="value"`
            const psMatch = /^\$env:([A-Z_][\w]*)\s*=\s*(.+)$/i.exec(trimmed);

            if (psMatch) {
                const [, name, rawValue] = psMatch;

                process.env[name!] = rawValue!.replace(/^["']|["']$/g, "");
                continue;
            }

            // cmd:  `set "NAME=value"`  or  `set NAME=value`
            const cmdMatch = /^set\s+"?([A-Z_][\w]*)=(.*?)"?$/i.exec(trimmed);

            if (cmdMatch) {
                const [, name, value] = cmdMatch;

                process.env[name!] = value!;
                continue;
            }

            // bash:  `export NAME=value`  or bare `NAME=value`
            const bashMatch = /^(?:export\s+)?([A-Z_][\w]*)=(.+)$/i.exec(trimmed);

            if (bashMatch) {
                const [, name, rawValue] = bashMatch;

                process.env[name!] = rawValue!.replace(/^["']|["']$/g, "");
            }
        }
    } catch (cause: unknown) {
        logger.warn(`toolchain: could not activate fnm env (${(cause as Error).message}). Subsequent tasks may use the previous Node version.`);
    }
};
