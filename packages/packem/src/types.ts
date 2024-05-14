import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupCommonJSOptions } from "@rollup/plugin-commonjs";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type { RollupWasmOptions } from "@rollup/plugin-wasm";
import type { FilterPattern } from "@rollup/pluginutils";
import type { PackageJson, TsConfigResult } from "@visulima/package";
import type { Pail } from "@visulima/pail";
import type { Hookable } from "hookable";
import type { JITIOptions } from "jiti";
import type { OutputOptions, RollupBuild, RollupOptions, RollupWatcher } from "rollup";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";
import type { NodePolyfillsOptions } from "rollup-plugin-polyfill-node";
import type { PluginVisualizerOptions } from "rollup-plugin-visualizer";

import type { CJSInteropOptions } from "./rollup/plugins/cjs-interop";
import type { CopyPluginOptions } from "./rollup/plugins/copy";
import type { Options as EsbuildOptions } from "./rollup/plugins/esbuild/types";
import type { JSXRemoveAttributesPlugin } from "./rollup/plugins/jsx-remove-attributes";
import type { LicenseOptions } from "./rollup/plugins/license";
import type { RawLoaderOptions } from "./rollup/plugins/raw";
import type { SucrasePluginConfig } from "./rollup/plugins/sucrase";
import type { SwcPluginConfig } from "./rollup/plugins/swc";
import type { PatchTypesOptions } from "./rollup/plugins/typescript/patch-typescript-types";

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

interface RollupDynamicImportVariablesOptions {
    /**
     * By default, the plugin will not throw errors when target files are not found.
     * Setting this option to true will result in errors thrown when encountering files which don't exist.
     * @default false
     */
    errorWhenNoFilesFound?: boolean;
    /**
     * A picomatch pattern, or array of patterns, which specifies the files in the build the plugin
     * should _ignore_.
     * By default no files are ignored.
     */
    exclude?: FilterPattern;
    /**
     * A picomatch pattern, or array of patterns, which specifies the files in the build the plugin
     * should operate on.
     * By default all files are targeted.
     */
    include?: FilterPattern;
    /**
     * By default, the plugin quits the build process when it encounters an error.
     * If you set this option to true, it will throw a warning instead and leave the code untouched.
     * @default false
     */
    warnOnError?: boolean;
}

export interface RollupBuildOptions {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    alias: RollupAliasOptions | false;
    cjsInterop?: CJSInteropOptions;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    commonjs: RollupCommonJSOptions | false;
    copy?: CopyPluginOptions | false;
    dts: RollupDtsOptions;
    dynamicVars?: RollupDynamicImportVariablesOptions | false;
    emitCJS?: boolean;
    emitESM?: boolean;
    esbuild: EsbuildOptions | false;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    json: RollupJsonOptions | false;
    jsxRemoveAttributes?: JSXRemoveAttributesPlugin | false;
    license?: LicenseOptions | false;
    metafile?: boolean;
    output?: OutputOptions;
    patchTypes: PatchTypesOptions | false;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    polyfillNode?: NodePolyfillsOptions | false;
    preserveDynamicImports?: boolean;
    raw?: RawLoaderOptions | false;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    replace: RollupReplaceOptions | false;
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    resolve: RollupNodeResolveOptions | false;
    shim?: boolean;
    sucrase?: SucrasePluginConfig | false;
    swc?: SwcPluginConfig | false;
    treeshake?: RollupOptions["treeshake"];
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    visualizer?: PluginVisualizerOptions | false;
    watch?: RollupOptions["watch"];
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    wsam?: RollupWasmOptions | false;
}

export type BuildEntry = {
    declaration?: boolean | "compatible" | "node16";
    format?: string;
    input: string;
    isExecutable?: boolean;
    name?: string;
    outDir?: string;
};

export interface BuildOptions {
    alias: Record<string, string>;
    cjsInterop?: boolean;
    clean: boolean;
    /**
     * * `compatible` means "src/index.ts" will generate "dist/index.d.mts", "dist/index.d.cts" and "dist/index.d.ts".
     * * `node16` means "src/index.ts" will generate "dist/index.d.mts" and "dist/index.d.cts".
     * * `true` is equivalent to `compatible`.
     * * `false` will disable declaration generation.
     * * `undefined` will auto detect based on "package.json". If "package.json" has "types" field, it will be `"compatible"`, otherwise `false`.
     */
    declaration?: boolean | "compatible" | "node16";
    dependencies: string[];
    devDependencies: string[];
    entries: BuildEntry[];
    externals: (RegExp | string)[];
    failOnWarn?: boolean;
    name: string;
    optionalDependencies: string[];
    outDir: string;
    peerDependencies: string[];
    replace: Record<string, string>;
    rollup: RollupBuildOptions;
    rootDir: string;
    /** @experimental */
    sourcemap: boolean;
    stub: boolean;
    stubOptions: { jiti: Omit<JITIOptions, "onError" | "transform"> };
    target: string;
    transformer: "esbuild" | "sucrase" | "swc";
}

export interface BuildHooks {
    "build:before": (context: BuildContext) => Promise<void> | void;
    "build:done": (context: BuildContext) => Promise<void> | void;
    "build:prepare": (context: BuildContext) => Promise<void> | void;

    "rollup:build": (context: BuildContext, build: RollupBuild) => Promise<void> | void;
    "rollup:done": (context: BuildContext) => Promise<void> | void;

    "rollup:dts:build": (context: BuildContext, build: RollupBuild) => Promise<void> | void;
    "rollup:dts:done": (context: BuildContext) => Promise<void> | void;
    "rollup:dts:options": (context: BuildContext, options: RollupOptions) => Promise<void> | void;

    "rollup:options": (context: BuildContext, options: RollupOptions) => Promise<void> | void;
    "rollup:watch": (context: BuildContext, watcher: RollupWatcher) => Promise<void> | void;
}

export type BuildContextBuildEntry = {
    bytes?: number;
    chunk?: boolean;
    chunks?: string[];
    exports?: string[];
    modules?: { bytes: number; id: string }[];
    path: string;
    type?: "asset" | "chunk" | "entry";
};

export interface BuildContext {
    buildEntries: BuildContextBuildEntry[];
    dependencyGraphMap: Map<string, Set<[string, string]>>;
    hooks: Hookable<BuildHooks>;
    logger: Pail<never, string>;
    mode: Mode;
    options: BuildOptions;
    pkg: PackageJson;
    rootDir: string;
    tsconfig?: TsConfigResult;
    usedImports: Set<string>;
    warnings: Set<string>;
}

export type BuildPreset = BuildConfig | (() => BuildConfig);

/**
 * In addition to basic `entries`, `presets`, and `hooks`,
 * there are also all the properties of `BuildOptions` except for BuildOptions's `entries`.
 */
export interface BuildConfig extends DeepPartial<Omit<BuildOptions, "entries">> {
    entries?: (BuildEntry | string)[];
    hooks?: Partial<BuildHooks>;
    preset?: BuildPreset | string;
}

export type InferEntriesResult = {
    cjs?: boolean;
    dts?: boolean;
    entries: BuildEntry[];
    esm?: boolean;
    warnings: string[];
};

export type Mode = "build" | "jit" | "watch";
