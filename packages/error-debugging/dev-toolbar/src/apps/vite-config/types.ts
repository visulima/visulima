import type { BaseComponents, ViewElement, ViewSpec } from "../../json-view";

export interface PluginInfo {
    enforce?: "post" | "pre";
    name: string;
}

/** The snapshot `getViteConfig` returns. Mirrors `src/rpc/functions/vite-config.ts`. */
export interface ViteConfig {
    base: string;
    build?: Record<string, unknown>;
    cacheDir?: string;
    css?: { devSourcemap?: boolean; preprocessors?: string[] };
    define?: Record<string, unknown>;
    env?: Record<string, string>;
    envDir?: string;
    envPrefix?: string | string[];
    esbuild?: Record<string, unknown>;
    mode: string;
    optimizeDeps?: { exclude?: string[]; include?: string[] };
    plugins?: PluginInfo[];
    publicDir?: string;
    resolve?: {
        alias?: unknown;
        conditions?: string[];
        dedupe?: string[];
        extensions?: string[];
        mainFields?: string[];
        preserveSymlinks?: boolean;
    };
    root: string;
    server?: {
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
    ssr?: { external?: string[]; noExternal?: boolean | string[]; target?: string };
}

/** Base vocabulary plus the two components this panel hand-writes. */
export type ViteConfigComponents = BaseComponents & {
    EnvTable: { rows: { key: string; value: string }[] };
    PluginList: { plugins: PluginInfo[] };
};

export type ViteConfigElement = ViewElement<ViteConfigComponents>;

export type ViteConfigSpec = ViewSpec<ViteConfigComponents>;
