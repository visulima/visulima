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
import { readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { dirname, join } from "@visulima/path";

import { transformTs } from "#native";

const TS_RE = /\.[cm]?tsx?$/;

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
                    const resolvedPath = probe(fileURLToPath(target));

                    if (resolvedPath !== undefined) {
                        return { shortCircuit: true, url: pathToFileURL(resolvedPath).href };
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
