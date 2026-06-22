/**
 * Runtime TypeScript/JSX loader — transpiles `.ts`/`.tsx`/`.mts`/`.cts` on import
 * via vis-native's oxc transform (`transform_ts`). Replaces the `jiti` dependency
 * for config loading, generators, and `vis x`: one native addon, no extra dep.
 *
 * Two tiers, hidden behind {@link importTs}:
 *   - Node 22.15+ / 24 — a synchronous `module.registerHooks` load hook transpiles
 *     the whole import graph; cache-busting is a `?v=` query so repeated config
 *     loads see fresh module state (replacing jiti's `moduleCache: false`).
 *   - Node 22.14.x (no `registerHooks`) — transpile the entry to a sibling temp
 *     `.mjs` and import that. Bundler-safe (no worker file). Narrow limitation:
 *     the entry's local `.ts` imports aren't transpiled on 22.14 — recommend
 *     22.15+ for that; config/`vis x` entries themselves work everywhere.
 */
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readJson5Sync } from "@visulima/fs/json5";
import { readJsoncSync } from "@visulima/fs/jsonc";
import { readTomlSync } from "@visulima/fs/toml";
import { stripJsonComments } from "@visulima/fs/utils";
import { readYamlSync } from "@visulima/fs/yaml";
import { dirname, isAbsolute, join, resolve as resolvePath } from "@visulima/path";

import { transformTs } from "#native";

const TS_RE = /\.[cm]?tsx?$/;

/**
 * Data-file extensions the load hook parses into an ESM module whose `default`
 * export is the parsed value. `.txt` yields the raw file contents as a string.
 * Order matters only for the resolve-hook probe (longer/more-specific first is
 * not required since these are matched by exact suffix).
 */
const DATA_EXT_CANDIDATES = [".yaml", ".yml", ".toml", ".jsonc", ".json5", ".txt"];

const DATA_EXT_RE = /\.(?:ya?ml|toml|jsonc|json5|txt)$/;

/**
 * Parse a recognised data file into a JS value. `.txt` returns the raw string;
 * the structured formats reuse `@visulima/fs` parsers (which wrap `yaml`,
 * `smol-toml`, `jsonc-parser`, and `json5` — all already on the dependency
 * graph), so no new runtime dependency is introduced.
 */
const parseDataFile = (filename: string): unknown => {
    if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
        return readYamlSync(filename);
    }

    if (filename.endsWith(".toml")) {
        return readTomlSync(filename);
    }

    if (filename.endsWith(".jsonc")) {
        // Tolerate trailing commas the way tsconfig/editor JSONC does.
        return readJsoncSync(filename, { allowTrailingComma: true });
    }

    if (filename.endsWith(".json5")) {
        return readJson5Sync(filename);
    }

    // `.txt` — raw contents, no parsing.
    return readFileSync(filename, "utf8");
};

/**
 * Serialize a parsed data value into a JS expression for the generated module.
 * Unlike `JSON.stringify`, this preserves the values data parsers legitimately
 * produce that JSON cannot represent: non-finite numbers (`.inf`/`.nan` in
 * YAML/TOML → `Infinity`/`NaN`, not `null`), `Date` (TOML datetimes → a real
 * `Date`, not an ISO string), `BigInt`, and `undefined` (empty YAML).
 */
const serializeForModule = (value: unknown): string => {
    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    if (typeof value === "number") {
        if (Number.isNaN(value)) {
            return "NaN";
        }

        if (value === Number.POSITIVE_INFINITY) {
            return "Infinity";
        }

        if (value === Number.NEGATIVE_INFINITY) {
            return "-Infinity";
        }

        return String(value);
    }

    if (typeof value === "bigint") {
        return `${value}n`;
    }

    if (typeof value === "boolean") {
        return String(value);
    }

    if (typeof value === "string") {
        return JSON.stringify(value);
    }

    if (value instanceof Date) {
        return `new Date(${JSON.stringify(value.toISOString())})`;
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => serializeForModule(item)).join(",")}]`;
    }

    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}:${serializeForModule(item)}`);

        return `{${entries.join(",")}}`;
    }

    // Functions/symbols can't come from these parsers; emit null defensively.
    return "null";
};

/**
 * Minimal tsconfig `compilerOptions.baseUrl` + `paths` resolver.
 *
 * NOTE: `@visulima/tsconfig` (`findTsConfigSync`) is the canonical reader and
 * handles the full `extends` surface (array reverse-merge, package `extends` via
 * `exports`) more faithfully than this does. Migrating to it is the right
 * follow-up; it's deferred only because the loader's tests are gated to a Node
 * with `module.registerHooks` (22.15+), so the swap can't be runtime-verified in
 * all CI environments. Adding it is `@visulima/tsconfig: workspace:*` (its deps
 * are already on vis's graph).
 *
 * This hand-rolled reader covers the common case: it walks up to the nearest
 * tsconfig, follows a single string `extends` (and, for an `extends` ARRAY, the
 * last entry — the highest-precedence one — only) merging `compilerOptions`
 * nearest-wins, and resolves `paths`/`baseUrl`. Multi-entry `extends` arrays and
 * package `extends` are best-effort.
 */
interface TsConfigShape {
    compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
    };
    extends?: string | string[];
}

interface ResolvedTsConfigPaths {
    /** Whether a `baseUrl` was set (enables bare baseUrl-rooted resolution). */
    hasBaseUrl: boolean;
    paths: Record<string, string[]>;
    /** Absolute directory that `paths` targets are resolved against. */
    pathsBase: string;
}

const tsconfigCache = new Map<string, ResolvedTsConfigPaths | undefined>();

const readRawTsConfig = (tsconfigPath: string): TsConfigShape | undefined => {
    try {
        const stripped = stripJsonComments(readFileSync(tsconfigPath, "utf8"), { whitespace: false });
        // Tolerate trailing commas the way tsconfig parsers do; `stripJsonComments`
        // only removes comments, so drop dangling commas before `}`/`]`.
        const withoutTrailingCommas = stripped.replaceAll(/,(\s*[\]}])/g, "$1");

        return JSON.parse(withoutTrailingCommas) as TsConfigShape;
    } catch {
        return undefined;
    }
};

/**
 * Find the nearest `tsconfig.json` walking up from `startDirectory`, resolve its
 * `extends` chain (relative + local node_modules best-effort), and return the
 * effective `baseUrl`/`paths` plus the directory `baseUrl` is relative to.
 */
const loadTsConfigPaths = (startDirectory: string): ResolvedTsConfigPaths | undefined => {
    if (tsconfigCache.has(startDirectory)) {
        return tsconfigCache.get(startDirectory);
    }

    let directory = startDirectory;
    let tsconfigPath: string | undefined;

    // Walk up to the filesystem root looking for a tsconfig.json.

    while (true) {
        const candidate = join(directory, "tsconfig.json");

        if (existsSync(candidate)) {
            tsconfigPath = candidate;

            break;
        }

        const parent = dirname(directory);

        if (parent === directory) {
            break;
        }

        directory = parent;
    }

    if (tsconfigPath === undefined) {
        tsconfigCache.set(startDirectory, undefined);

        return undefined;
    }

    // Merge the extends chain: start from the furthest ancestor, let nearer
    // configs override. We collect configs root-first.
    const chain: { config: TsConfigShape; directory: string }[] = [];
    const seen = new Set<string>();
    let current: string | undefined = tsconfigPath;

    while (current !== undefined && !seen.has(current)) {
        seen.add(current);

        const config = readRawTsConfig(current);

        if (config === undefined) {
            break;
        }

        chain.unshift({ config, directory: dirname(current) });

        const extendsField = config.extends;
        const firstExtend = Array.isArray(extendsField) ? extendsField[extendsField.length - 1] : extendsField;

        if (typeof firstExtend !== "string") {
            break;
        }

        if (firstExtend.startsWith(".") || isAbsolute(firstExtend)) {
            let resolved = resolvePath(dirname(current), firstExtend);

            if (!resolved.endsWith(".json")) {
                resolved = `${resolved}.json`;
            }

            current = existsSync(resolved) ? resolved : undefined;
        } else {
            // Bare package extends — best-effort lookup under local node_modules.
            const packageCandidate = join(dirname(current), "node_modules", firstExtend);
            const withJson = packageCandidate.endsWith(".json") ? packageCandidate : `${packageCandidate}.json`;

            current = existsSync(withJson) ? withJson : undefined;
        }
    }

    // Absolute directory `baseUrl` points at (when any config sets it); nearest wins.
    let baseUrlDirectory: string | undefined;
    // Directory the most-recent `paths` block was declared in (its fallback base).
    let pathsDeclarationDirectory: string | undefined;
    let paths: Record<string, string[]> = {};

    for (const { config, directory: configDirectory } of chain) {
        const options = config.compilerOptions;

        if (options?.baseUrl !== undefined) {
            baseUrlDirectory = resolvePath(configDirectory, options.baseUrl);
        }

        if (options?.paths !== undefined) {
            paths = options.paths;
            pathsDeclarationDirectory = configDirectory;
        }
    }

    // TS resolves `paths` relative to `baseUrl` when set; otherwise (TS 5+ allows
    // `paths` without `baseUrl`) relative to the config that declared `paths`.
    const pathsBase = baseUrlDirectory ?? pathsDeclarationDirectory ?? dirname(tsconfigPath);

    const result: ResolvedTsConfigPaths = {
        hasBaseUrl: baseUrlDirectory !== undefined,
        paths,
        pathsBase,
    };

    tsconfigCache.set(startDirectory, result);

    return result;
};

/**
 * Resolve a bare specifier against tsconfig `baseUrl` + `paths`. Returns an
 * absolute filesystem path (post-probe) or undefined when no alias matches.
 */
const resolveTsConfigPaths = (specifier: string, parentDirectory: string): string | undefined => {
    const config = loadTsConfigPaths(parentDirectory);

    if (config === undefined) {
        return undefined;
    }

    const { hasBaseUrl, pathsBase } = config;

    const probeBoth = (candidate: string): string | undefined => probe(candidate) ?? probeData(candidate);

    // 1. Explicit `paths` aliases (wildcard + exact).
    for (const [pattern, targets] of Object.entries(config.paths)) {
        const starIndex = pattern.indexOf("*");

        if (starIndex === -1) {
            if (pattern === specifier) {
                for (const target of targets) {
                    const resolved = probeBoth(resolvePath(pathsBase, target));

                    if (resolved !== undefined) {
                        return resolved;
                    }
                }
            }

            continue;
        }

        const prefix = pattern.slice(0, starIndex);
        const suffix = pattern.slice(starIndex + 1);

        if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
            const matched = specifier.slice(prefix.length, specifier.length - suffix.length);

            for (const target of targets) {
                const filled = target.replace("*", matched);
                const resolved = probeBoth(resolvePath(pathsBase, filled));

                if (resolved !== undefined) {
                    return resolved;
                }
            }
        }
    }

    // 2. baseUrl-rooted bare resolution (when a baseUrl is set, TS resolves
    //    non-relative specifiers against it before node_modules).
    if (hasBaseUrl) {
        const resolved = probeBoth(resolvePath(pathsBase, specifier));

        if (resolved !== undefined) {
            return resolved;
        }
    }

    return undefined;
};

interface RegisterHooksModule {
    registerHooks?: (hooks: {
        load: (url: string, context: unknown, nextLoad: (u: string, c: unknown) => unknown) => unknown;
        resolve: (specifier: string, context: { parentURL?: string }, nextResolve: (s: string, c: unknown) => unknown) => unknown;
    }) => void;
}

let hookRegistered = false;
let freshCounter = 0;
let warnedNoRegisterHooks = false;
let sourceMapsEnabled = false;

/**
 * Turn on V8 source-map support once, so stack traces map to the original TS (the
 * transform emits inline source maps). Idempotent; safe on the supported floor.
 */
const enableSourceMapsOnce = (): void => {
    if (sourceMapsEnabled) {
        return;
    }

    sourceMapsEnabled = true;
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- runtime-guarded optional call; present since Node 16.6
    (process as { setSourceMapsEnabled?: (value: boolean) => void }).setSourceMapsEnabled?.(true);
};

const stripQuery = (url: string): string => {
    const index = url.indexOf("?");

    return index === -1 ? url : url.slice(0, index);
};

/** `.cts` is CommonJS; everything else we treat as ESM output. */
const formatFor = (filename: string): "commonjs" | "module" => (filename.endsWith(".cts") ? "commonjs" : "module");

const EXT_CANDIDATES = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json"];

const isFile = (path: string): boolean => {
    try {
        return statSync(path).isFile();
    } catch {
        return false;
    }
};

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path).isDirectory();
    } catch {
        return false;
    }
};

/** `import "./x.js"` resolves to `./x.ts` when the `.js` file doesn't exist (nodenext authoring). */
const jsToTsSibling = (path: string): string | undefined => {
    if (path.endsWith(".js")) {
        return `${path.slice(0, -3)}.ts`;
    }

    if (path.endsWith(".mjs")) {
        return `${path.slice(0, -4)}.mts`;
    }

    if (path.endsWith(".cjs")) {
        return `${path.slice(0, -4)}.cts`;
    }

    return undefined;
};

/**
 * Resolve a filesystem path the way TS tooling (and jiti) does: exact file, then
 * the `.js`→`.ts` swap, then extension probing, then directory `index.*`. Returns
 * the resolved absolute path, or undefined to let Node's resolver take over.
 */
const probe = (path: string): string | undefined => {
    if (isFile(path)) {
        return path;
    }

    const swap = jsToTsSibling(path);

    if (swap !== undefined && isFile(swap)) {
        return swap;
    }

    for (const ext of EXT_CANDIDATES) {
        if (isFile(path + ext)) {
            return path + ext;
        }
    }

    if (isDirectory(path)) {
        for (const ext of EXT_CANDIDATES) {
            const indexCandidate = `${path}/index${ext}`;

            if (isFile(indexCandidate)) {
                return indexCandidate;
            }
        }
    }

    return undefined;
};

/**
 * Probe data-file extensions (.yaml/.yml/.toml/.jsonc/.json5/.txt) for an
 * extensionless or partially-specified import. Runs after {@link probe} so
 * code modules always win when both exist.
 */
const probeData = (path: string): string | undefined => {
    if (isFile(path) && DATA_EXT_RE.test(path)) {
        return path;
    }

    for (const ext of DATA_EXT_CANDIDATES) {
        if (isFile(path + ext)) {
            return path + ext;
        }
    }

    return undefined;
};

/**
 * Register the sync load hook once, if `module.registerHooks` exists. Returns
 * whether a graph-wide hook is active.
 */
const ensureRegisterHooks = (): boolean => {
    enableSourceMapsOnce();

    // Feature-detected on purpose: present on Node 22.15+/24, absent on the
    // 22.14.x floor (which takes the temp-file fallback in importTs).
    // eslint-disable-next-line n/no-unsupported-features/node-builtins -- runtime feature-detect with a fallback
    const { registerHooks } = nodeModule as unknown as RegisterHooksModule;

    if (typeof registerHooks !== "function") {
        return false;
    }

    if (hookRegistered) {
        return true;
    }

    registerHooks({
        load(url, context, nextLoad) {
            const clean = stripQuery(url);

            if (clean.startsWith("file:") && TS_RE.test(clean)) {
                const filename = fileURLToPath(clean);
                const { code } = transformTs(filename, readFileSync(filename, "utf8"));

                return { format: formatFor(filename), shortCircuit: true, source: code };
            }

            // Data files (.yaml/.yml/.toml/.jsonc/.json5/.txt) become an ESM module
            // whose default export is the parsed value (raw string for .txt). Built-in
            // `.json` is left to Node's native JSON module support.
            if (clean.startsWith("file:") && DATA_EXT_RE.test(clean)) {
                const filename = fileURLToPath(clean);
                const value = parseDataFile(filename);

                return {
                    format: "module",
                    shortCircuit: true,
                    source: `export default ${serializeForModule(value)};\n`,
                };
            }

            return nextLoad(url, context);
        },
        // Extension/index probing + .js→.ts swap for relative specifiers, matching
        // TS tooling (and the jiti resolver this replaces). Bare specifiers and
        // node: builtins fall through to Node's resolver untouched.
        resolve(specifier, context, nextResolve) {
            if ((specifier.startsWith(".") || specifier.startsWith("/")) && context.parentURL !== undefined) {
                let target: URL | undefined;

                try {
                    target = new URL(specifier, context.parentURL);
                } catch {
                    target = undefined;
                }

                if (target?.protocol === "file:") {
                    const targetPath = fileURLToPath(target);
                    const resolvedPath = probe(targetPath) ?? probeData(targetPath);

                    if (resolvedPath !== undefined) {
                        return { shortCircuit: true, url: pathToFileURL(resolvedPath).href };
                    }
                }
            }

            // tsconfig `baseUrl`/`paths` aliases for bare specifiers that aren't
            // node: builtins. node_modules packages still fall through to Node's
            // resolver because the alias probe only returns on a real on-disk hit.
            if (
                context.parentURL !== undefined
                && !specifier.startsWith(".")
                && !specifier.startsWith("/")
                && !specifier.startsWith("#")
                && !specifier.startsWith("node:")
                && !nodeModule.isBuiltin?.(specifier)
            ) {
                let parentDirectory: string | undefined;

                try {
                    parentDirectory = dirname(fileURLToPath(context.parentURL));
                } catch {
                    parentDirectory = undefined;
                }

                if (parentDirectory !== undefined) {
                    const aliased = resolveTsConfigPaths(specifier, parentDirectory);

                    if (aliased !== undefined) {
                        return { shortCircuit: true, url: pathToFileURL(aliased).href };
                    }
                }
            }

            return nextResolve(specifier, context);
        },
    });

    hookRegistered = true;

    return true;
};

/**
 * Register the oxc TS load/resolve hooks for the rest of this process, returning
 * whether a graph-wide hook is active (false on the 22.14.x floor). Used by the
 * launcher's `x` preload (`preload.ts`) so a directly-spawned Node transpiles the
 * entry + its imports without going through {@link importTs}.
 */
export const registerTsHooks = (): boolean => ensureRegisterHooks();

/**
 * Import a `.ts`/`.js` file at `absolutePath`, transpiling TS via oxc. Each call
 * loads a fresh module instance (config can be re-read without stale state).
 */
export const importTs = async (absolutePath: string): Promise<Record<string, unknown>> => {
    freshCounter += 1;

    if (ensureRegisterHooks()) {
        const url = `${pathToFileURL(absolutePath).href}?v=${String(freshCounter)}`;

        return (await import(url)) as Record<string, unknown>;
    }

    // Node 22.14 fallback: transpile the entry to a sibling temp file and import it.
    // Limitation: only the ENTRY is transpiled — its local `.ts` imports resolve
    // through Node, which can't load them (opaque ERR_MODULE_NOT_FOUND/parse error).
    // Warn once so the failure points at the cause, not the symptom. 22.14 is the
    // supported floor; 22.15+ takes the graph-wide hook path above.
    if (!warnedNoRegisterHooks) {
        warnedNoRegisterHooks = true;
        process.stderr.write(
            "vis: Node < 22.15 has no module.registerHooks — only the entry file is transpiled; "
            + "local TypeScript imports won't load. Upgrade to Node >= 22.15 for full support.\n",
        );
    }

    const { code } = transformTs(absolutePath, readFileSync(absolutePath, "utf8"));
    const temporaryPath = join(dirname(absolutePath), `.vis-ts-${String(freshCounter)}-${String(process.pid)}.mjs`);

    writeFileSync(temporaryPath, code);

    try {
        return (await import(pathToFileURL(temporaryPath).href)) as Record<string, unknown>;
    } finally {
        try {
            unlinkSync(temporaryPath);
        } catch {
            // best-effort cleanup
        }
    }
};
