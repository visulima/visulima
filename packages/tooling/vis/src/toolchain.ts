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
import { delimiter, sep } from "node:path";

import { isAccessibleSync, readFileSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

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
     * When `true`, `vis run` / `vis ci` will call `<manager> install` on
     * engines.node mismatch instead of bailing. Defaults to `true` iff
     * a manager is detected and no explicit value is set.
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
    asdf: ["bun", "deno", "go", "node", "python", "ruby", "rust"],
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
 * Reads `PATH` and returns `true` if `binary` is executable. Cheaper than
 * spawning `which` because we only stat candidate paths.
 */
const isOnPath = (binary: string): string | undefined => {
    const pathEnv = process.env["PATH"];

    if (!pathEnv) {
        return undefined;
    }

    const isWindows = process.platform === "win32";
    const exts = isWindows ? (process.env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";") : [""];

    for (const dir of pathEnv.split(delimiter)) {
        if (dir === "") {
            continue;
        }

        for (const ext of exts) {
            const candidate = `${dir}${sep}${binary}${ext}`;

            if (isAccessibleSync(candidate)) {
                return candidate;
            }
        }
    }

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

export const findInstalledManagers = (workspaceRoot: string): readonly DetectedManager[] => {
    const results: DetectedManager[] = [];

    for (const name of MANAGER_ORDER) {
        const binary = name === "nvm" ? undefined : isOnPath(name);
        // nvm is a shell function, not a real binary — treat it as
        // installed when $NVM_DIR exists.
        const nvmInstalled = name === "nvm" && Boolean(process.env["NVM_DIR"]);

        const configFiles = configFilesFor(name, workspaceRoot);
        const installed = Boolean(binary) || nvmInstalled;

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

    return results;
};

/**
 * Picks the best version manager for this workspace. Order:
 *
 *   1. `config.preferredManager` (explicit user override).
 *   2. First detected manager that (a) is installed AND (b) has a
 *      workspace-local config file.
 *   3. First installed manager — even without local config, the user
 *      clearly uses it.
 *   4. First manager with a matching local config file (so we can at
 *      least point the user at an installer).
 *   5. `{ name: "none", ... }` — nothing recognised.
 */
export const detectVersionManager = (workspaceRoot: string, config?: ToolchainConfig): DetectedManager => {
    const detected = findInstalledManagers(workspaceRoot);

    if (config?.preferredManager && config.preferredManager !== "none") {
        const match = detected.find((d) => d.name === config.preferredManager);

        if (match) {
            return match;
        }

        // User pinned a manager we couldn't find — surface it as "not installed".
        return {
            configFiles: [],
            installed: false,
            name: config.preferredManager,
        };
    }

    const withConfig = detected.find((d) => d.installed && d.configFiles.length > 0);

    if (withConfig) {
        return withConfig;
    }

    const anyInstalled = detected.find((d) => d.installed);

    if (anyInstalled) {
        return anyInstalled;
    }

    const configOnly = detected.find((d) => d.configFiles.length > 0);

    if (configOnly) {
        return configOnly;
    }

    return { configFiles: [], installed: false, name: "none" };
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
 * Returns the version of a runtime tool on PATH. For `node` we use
 * `process.versions.node` so the reported version always matches the
 * shell that launched vis.
 */
const queryToolVersion = (tool: RuntimeTool): string | undefined => {
    if (tool === "node") {
        return process.versions.node;
    }

    const binary = isOnPath(tool);

    if (!binary) {
        return undefined;
    }

    return queryManagerVersion(binary);
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
        const override = detected.find((d) => d.name === config.preferredManager);

        if (override && canHandle(config.preferredManager, spec.tool)) {
            return { installed: override.installed, name: override.name };
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
    if (name === "none" || name === "self-activate") {
        return name === "self-activate" && (tool === "pnpm" || tool === "yarn");
    }

    return MANAGER_CAPABILITIES[name].includes(tool);
};

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
                return { args: ["install"], bin: "corepack", hint: "reads the packageManager field in package.json" };
            }

            // `corepack install` without args reads packageManager. For
            // an explicit pin we prepare+activate so the shim works
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
