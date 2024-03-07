import type { Hookable } from "hookable";
import type { OutputOptions, RollupBuild, RollupOptions } from "rollup";
import type { JITIOptions } from "jiti";
import type { RollupReplaceOptions } from "@rollup/plugin-replace";
import type { RollupAliasOptions } from "@rollup/plugin-alias";
import type { RollupNodeResolveOptions } from "@rollup/plugin-node-resolve";
import type { RollupJsonOptions } from "@rollup/plugin-json";
import type { Options as EsbuildOptions } from "rollup-plugin-esbuild";
import type { RollupCommonJSOptions } from "vite";
import type { Options as RollupDtsOptions } from "rollup-plugin-dts";
import type { PackageJson } from "@visulima/package";

export interface BaseBuildEntry {
  builder?: "rollup";
  input: string;
  name?: string;
  outDir?: string;
  declaration?: "compatible" | "node16" | boolean;
}

export interface RollupBuildEntry extends BaseBuildEntry {
  builder: "rollup";
}

export type BuildEntry =
  | BaseBuildEntry
  | RollupBuildEntry;

export interface RollupBuildOptions {
  emitCJS?: boolean;
  cjsBridge?: boolean;
  preserveDynamicImports?: boolean;
  inlineDependencies?: boolean;
  output?: OutputOptions;
  // Plugins
  replace: RollupReplaceOptions | false;
  alias: RollupAliasOptions | false;
  resolve: RollupNodeResolveOptions | false;
  json: RollupJsonOptions | false;
  esbuild: EsbuildOptions | false;
  commonjs: RollupCommonJSOptions | false;
  dts: RollupDtsOptions;
}

export interface BuildOptions {
    name: string;
    rootDir: string;
    entries: BuildEntry[];
    clean: boolean;
    /** @experimental */
    sourcemap: boolean;
    /**
     * * `compatible` means "src/index.ts" will generate "dist/index.d.mts", "dist/index.d.cts" and "dist/index.d.ts".
     * * `node16` means "src/index.ts" will generate "dist/index.d.mts" and "dist/index.d.cts".
     * * `true` is equivalent to `compatible`.
     * * `false` will disable declaration generation.
     * * `undefined` will auto detect based on "package.json". If "package.json" has "types" field, it will be `"compatible"`, otherwise `false`.
     */
    declaration?: "compatible" | "node16" | boolean;
    outDir: string;
    stub: boolean;
    stubOptions: { jiti: Omit<JITIOptions, "transform" | "onError"> };
    externals: (string | RegExp)[];
    dependencies: string[];
    peerDependencies: string[];
    devDependencies: string[];
    alias: { [find: string]: string };
    replace: { [find: string]: string };
    failOnWarn?: boolean;
    rollup: RollupBuildOptions;
}

export interface BuildHooks {
    "build:prepare": (ctx: BuildContext) => void | Promise<void>;
    "build:before": (ctx: BuildContext) => void | Promise<void>;
    "build:done": (ctx: BuildContext) => void | Promise<void>;

    "rollup:options": (ctx: BuildContext, options: RollupOptions) => void | Promise<void>;
    "rollup:build": (ctx: BuildContext, build: RollupBuild) => void | Promise<void>;
    "rollup:dts:options": (ctx: BuildContext, options: RollupOptions) => void | Promise<void>;
    "rollup:dts:build": (ctx: BuildContext, build: RollupBuild) => void | Promise<void>;
    "rollup:done": (ctx: BuildContext) => void | Promise<void>;
}

export interface BuildContext {
    options: BuildOptions;
    pkg: PackageJson;
    buildEntries: {
        path: string;
        bytes?: number;
        exports?: string[];
        chunks?: string[];
        chunk?: boolean;
        modules?: { id: string; bytes: number }[];
    }[];
    usedImports: Set<string>;
    warnings: Set<string>;
    hooks: Hookable<BuildHooks>;
}
