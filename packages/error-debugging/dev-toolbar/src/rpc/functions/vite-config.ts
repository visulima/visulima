import type { ViteDevServer } from "vite";

type PluginInfo = {
    enforce?: "post" | "pre";
    name: string;
};

/** Alias entry with find always normalized to string (RegExp serialized as "/pattern/flags") */
type AliasEntry = { find: string; replacement: string };

type ViteConfigSnapshot = {
    base: string;
    build: {
        assetsDir?: string;
        assetsInlineLimit?: number;
        chunkSizeWarningLimit?: number;
        cssCodeSplit?: boolean;
        emptyOutDir?: boolean | null;
        minify?: "esbuild" | "oxc" | "terser" | boolean;
        outDir?: string;
        reportCompressedSize?: boolean;
        sourcemap?: "hidden" | "inline" | boolean;
        target?: false | string | string[];
    };
    cacheDir: string;
    css: {
        devSourcemap?: boolean;
        preprocessors: string[];
    };
    define?: Record<string, unknown>;
    env?: Record<string, string>;
    envDir?: string;
    envPrefix?: string | string[];
    esbuild?: {
        jsx?: string;
        jsxFactory?: string;
        jsxFragment?: string;
        jsxImportSource?: string;
        target?: string | string[];
    };
    mode: string;
    optimizeDeps: {
        exclude?: string[];
        include?: string[];
    };
    plugins: PluginInfo[];
    publicDir: string;
    resolve: {
        alias?: AliasEntry[] | Record<string, string>; // always string keys/finds
        conditions?: string[];
        dedupe?: string[];
        extensions?: string[];
        mainFields?: string[];
        preserveSymlinks?: boolean;
    };
    root: string;
    server: {
        cors?: boolean;
        hmrEnabled?: boolean;
        hmrPort?: number;
        host?: boolean | string;
        https?: boolean;
        middlewareMode?: boolean | string;
        open?: boolean | string;
        origin?: string;
        port?: number;
        proxy?: string[];
        strictPort?: boolean;
    };
    ssr?: {
        external?: string[];
        noExternal?: boolean | string[];
        target?: string;
    };
};

// Normalize alias: RegExp `find` values don't serialize over JSON (become {}).
// Convert them to their string representation "/pattern/flags".
const normalizeAlias = (rawAlias: unknown): AliasEntry[] | Record<string, string> | undefined => {
    if (Array.isArray(rawAlias)) {
        return (rawAlias as any[])

            .filter((entry: any) => entry !== null && entry !== undefined && (entry.find !== undefined || entry.replacement !== undefined))

            .map((entry: any) => {
                return {
                    find: entry.find instanceof RegExp ? entry.find.toString() : String(entry.find ?? ""),
                    replacement: String(entry.replacement ?? ""),
                };
            });
    }

    if (rawAlias !== undefined && rawAlias !== null && typeof rawAlias === "object") {
        return Object.fromEntries(Object.entries(rawAlias as Record<string, string>).map(([k, v]) => [k, String(v)]));
    }

    return undefined;
};

/**
 * Normalizes the `ssr.noExternal` Vite config value into a stable shape for
 * the toolbar UI. Vite accepts `true` (bundle everything), an array of
 * package names/patterns, or `undefined`. This helper coerces the raw config
 * value into one of those three forms so downstream code can rely on a
 * predictable type.
 */
const normalizeSsrNoExternal = (value: unknown): boolean | string[] | undefined => {
    if (typeof value === "boolean") {
        return value;
    }

    if (Array.isArray(value)) {
        return value as string[];
    }

    return undefined;
};

/**
 * Gets Vite configuration from the dev server.
 * @param server Vite dev server instance.
 * @returns Vite config snapshot with the most useful fields.
 */

const getViteConfig = async (server: ViteDevServer): Promise<ViteConfigSnapshot> => {
    const { config } = server;

    // Collect plugin info safely (filter out falsy entries and entries without a name)
    const plugins: PluginInfo[] = [];

    for (const p of (config.plugins as any[]).filter((entry: any) => Boolean(entry?.name))) {
        plugins.push({ enforce: p?.enforce, name: p.name as string });
    }

    const aliasNormalized = normalizeAlias(config.resolve?.alias);

    // Collect proxy route keys without leaking target URLs
    const proxyKeys = config.server?.proxy ? Object.keys(config.server.proxy) : undefined;

    // HMR settings
    const hmrRaw = config.server?.hmr;
    const hmrEnabled = hmrRaw !== false;

    const hmrPort = typeof hmrRaw === "object" && hmrRaw !== null ? (hmrRaw as any).port : undefined;

    const ssrNoExternalNormalized = normalizeSsrNoExternal(config.ssr?.noExternal);

    return {
        base: config.base,
        build: {
            assetsDir: config.build?.assetsDir,
            assetsInlineLimit: typeof config.build?.assetsInlineLimit === "number" ? config.build.assetsInlineLimit : undefined,
            chunkSizeWarningLimit: config.build?.chunkSizeWarningLimit,
            cssCodeSplit: config.build?.cssCodeSplit,
            emptyOutDir: config.build?.emptyOutDir,
            minify: config.build?.minify,
            outDir: config.build?.outDir,
            reportCompressedSize: config.build?.reportCompressedSize,
            sourcemap: config.build?.sourcemap,
            target: config.build?.target,
        },
        cacheDir: config.cacheDir,
        css: {
            devSourcemap: config.css?.devSourcemap,
            preprocessors: config.css?.preprocessorOptions ? Object.keys(config.css.preprocessorOptions) : [],
        },
        define: config.define,
        env: config.env,
        envDir: typeof config.envDir === "string" ? config.envDir : undefined,
        envPrefix: config.envPrefix,
        esbuild: config.esbuild
            ? {
                jsx: config.esbuild.jsx as string | undefined,
                jsxFactory: config.esbuild.jsxFactory,
                jsxFragment: config.esbuild.jsxFragment,
                jsxImportSource: config.esbuild.jsxImportSource,
                target: config.esbuild.target,
            }
            : undefined,
        mode: config.mode,
        optimizeDeps: {
            exclude: config.optimizeDeps?.exclude,
            include: config.optimizeDeps?.include,
        },
        plugins,
        publicDir: config.publicDir,
        resolve: {
            alias: aliasNormalized,
            conditions: config.resolve?.conditions,
            dedupe: config.resolve?.dedupe,
            extensions: config.resolve?.extensions,
            mainFields: config.resolve?.mainFields,
            preserveSymlinks: config.resolve?.preserveSymlinks,
        },
        root: config.root,
        server: {
            cors: config.server?.cors === undefined ? undefined : Boolean(config.server.cors),
            hmrEnabled,
            hmrPort,
            host: config.server?.host,
            https: config.server?.https !== undefined,
            // middlewareMode can be boolean or an object — normalise to boolean
            middlewareMode: ((): boolean | undefined => {
                if (config.server?.middlewareMode === undefined) {
                    return undefined;
                }

                if (typeof config.server.middlewareMode === "object") {
                    return true;
                }

                return Boolean(config.server.middlewareMode);
            })(),
            open: config.server?.open,
            origin: config.server?.origin,
            port: config.server?.port,
            proxy: proxyKeys,
            strictPort: config.server?.strictPort,
        },
        ssr:
            config.ssr === undefined
                ? undefined
                : {
                    // external can be string[] | true — normalise to string[] only
                    external: Array.isArray(config.ssr?.external) ? config.ssr.external : undefined,
                    noExternal: ssrNoExternalNormalized,
                    target: config.ssr?.target,
                },
    };
};

export { getViteConfig };
