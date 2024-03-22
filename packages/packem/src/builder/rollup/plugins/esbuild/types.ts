import type { Loader, TransformOptions } from "esbuild";
import type { FilterPattern } from "@rollup/pluginutils";
import type { MarkOptional } from "ts-essentials";
import type { ESBuildOptions } from "vite";

export type Options = Omit<TransformOptions, "sourcemap" | "loader"> & {
    include?: FilterPattern;
    exclude?: FilterPattern;
    sourceMap?: boolean;
    optimizeDeps?: MarkOptional<OptimizeDepsOptions, "cwd" | "sourceMap">;
    /**
     * Use this tsconfig file instead
     * Disable it by setting to `false`
     */
    tsconfig?: string | false;
    /**
     * Map extension to esbuild loader
     * Note that each entry (the extension) needs to start with a dot
     */
    loaders?: {
        [ext: string]: Loader | false;
    };
};

export type OptimizeDepsOptions = {
    include: string[];
    exclude?: string[];
    cwd: string;
    esbuildOptions?: ESBuildOptions;
    sourceMap: boolean;
};

export type Optimized = Map<string, { file: string }>;

export type OptimizeDepsResult = {
    optimized: Optimized;
    cacheDir: string;
};
