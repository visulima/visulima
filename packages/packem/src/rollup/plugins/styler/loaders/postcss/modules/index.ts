import type { Plugin } from "postcss";
import type Processor from "postcss/lib/processor";
import extractImports from "postcss-modules-extract-imports";
import localByDefault from "postcss-modules-local-by-default";
import modulesScope from "postcss-modules-scope";
import modulesValues from "postcss-modules-values";

import generateScopedNameDefault from "./generate";

/** Options for [CSS Modules](https://github.com/css-modules/css-modules) */
export interface ModulesOptions {
    /** Export global classes */
    exportGlobals?: boolean;
    /** Fail on wrong order of composition */
    failOnWrongOrder?: boolean;
    /**
     * Placeholder or function for scoped name generation.
     * Allowed blocks for placeholder:
     * - `[dir]`: The directory name of the asset.
     * - `[name]`: The file name of the asset excluding any extension.
     * - `[local]`: The original value of the selector.
     * - `[hash(:<num>)]`: A hash based on the name and content of the asset (with optional length).
     * @default "[name]_[local]__[hash:8]"
     */
    generateScopedName?: string | ((name: string, file: string, css: string) => string);
    /**
     * Default mode for classes
     * @default "local"
     */
    mode?: "global" | "local" | "pure";
}

export default (options: ModulesOptions): (Plugin | Processor)[] => {
    const options_ = {
        mode: "local" as const,
        ...options,
        generateScopedName:
            typeof options.generateScopedName === "function" ? options.generateScopedName : generateScopedNameDefault(options.generateScopedName),
    };

    return [
        modulesValues(),
        localByDefault({ mode: options_.mode }),
        extractImports({ failOnWrongOrder: options_.failOnWrongOrder }),
        modulesScope({
            exportGlobals: options_.exportGlobals,
            generateScopedName: options_.generateScopedName,
        }),
    ];
};
