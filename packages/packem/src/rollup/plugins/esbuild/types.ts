import type { FilterPattern } from "@rollup/pluginutils";
import type { BuildOptions as EsbuildOptions, Loader, TransformOptions } from "esbuild";
import type { MarkOptional } from "ts-essentials";

export type Options = Omit<TransformOptions, "loader" | "sourcemap"> & {
    exclude?: FilterPattern;
    include?: FilterPattern;
    /**
     * Map extension to esbuild loader
     * Note that each entry (the extension) needs to start with a dot
     */
    loaders?: Record<string, Loader | false>;
    optimizeDeps?: MarkOptional<OptimizeDepsOptions, "cwd" | "sourceMap">;
    sourceMap?: boolean;
};

export type OptimizeDepsOptions = {
    cwd: string;
    esbuildOptions?: EsbuildOptions;
    exclude?: string[];
    include: string[];
    sourceMap: boolean;
};

export type Optimized = Map<string, { file: string }>;

export type OptimizeDepsResult = {
    cacheDir: string;
    optimized: Optimized;
};
