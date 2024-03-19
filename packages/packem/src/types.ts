import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type { PackageJson } from "@visulima/package";
import type { Hookable } from "hookable";
import type { JITIOptions } from "jiti";
import type { OutputOptions, RollupBuild, RollupOptions } from "rollup";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";
import type { Options as EsbuildOptions } from "rollup-plugin-esbuild";
import type { RollupCommonJSOptions } from "vite";

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };

export interface BaseBuildEntry {
    builder?: "rollup";
    declaration?: boolean | "compatible" | "node16";
    input: string;
    name?: string;
    outDir?: string;
}

export interface RollupBuildEntry extends BaseBuildEntry {
    builder: "rollup";
}

export type BuildEntry = BaseBuildEntry | RollupBuildEntry;

export interface RollupBuildOptions {
    alias: RollupAliasOptions | false;
    cjsBridge?: boolean;
    commonjs: RollupCommonJSOptions | false;
    dts: RollupDtsOptions;
    emitCJS?: boolean;
    esbuild: EsbuildOptions | false;
    inlineDependencies?: boolean;
    json: RollupJsonOptions | false;
    output?: OutputOptions;
    preserveDynamicImports?: boolean;
    // Plugins
    replace: RollupReplaceOptions | false;
    resolve: RollupNodeResolveOptions | false;
}

export interface BuildOptions {
    alias: Record<string, string>;
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
    outDir: string;
    peerDependencies: string[];
    replace: Record<string, string>;
    rollup: RollupBuildOptions;
    rootDir: string;
    /** @experimental */
    sourcemap: boolean;
    stub: boolean;
    stubOptions: { jiti: Omit<JITIOptions, "onError" | "transform"> };
}

export interface BuildHooks {
    "build:before": (context: BuildContext) => Promise<void> | void;
    "build:done": (context: BuildContext) => Promise<void> | void;
    "build:prepare": (context: BuildContext) => Promise<void> | void;

    "rollup:build": (context: BuildContext, build: RollupBuild) => Promise<void> | void;
    "rollup:done": (context: BuildContext) => Promise<void> | void;
    "rollup:dts:build": (context: BuildContext, build: RollupBuild) => Promise<void> | void;
    "rollup:dts:options": (context: BuildContext, options: RollupOptions) => Promise<void> | void;
    "rollup:options": (context: BuildContext, options: RollupOptions) => Promise<void> | void;
}

export interface BuildContext {
    buildEntries: {
        bytes?: number;
        chunk?: boolean;
        chunks?: string[];
        exports?: string[];
        modules?: { bytes: number; id: string }[];
        path: string;
    }[];
    hooks: Hookable<BuildHooks>;
    options: BuildOptions;
    pkg: PackageJson;
    usedImports: Set<string>;
    warnings: Set<string>;
}

export interface BuildContext {
    buildEntries: {
        bytes?: number;
        chunk?: boolean;
        chunks?: string[];
        exports?: string[];
        modules?: { bytes: number; id: string }[];
        path: string;
    }[];
    hooks: Hookable<BuildHooks>;
    options: BuildOptions;
    pkg: PackageJson;
    usedImports: Set<string>;
    warnings: Set<string>;
}

export type BuildPreset = BuildConfig | (() => BuildConfig);

export interface BuildConfig extends DeepPartial<Omit<BuildOptions, "entries">> {
    entries?: (BuildEntry | string)[];
    hooks?: Partial<BuildHooks>;
    preset?: BuildPreset | string;
}

export type InferEntriesResult = {
  cjs?: boolean;
  dts?: boolean;
  entries: BuildEntry[];
  warnings: string[];
};
