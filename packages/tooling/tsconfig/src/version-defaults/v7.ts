/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

/**
 * TypeScript 7.0 default-flips.
 *
 * TypeScript 7.0 (the native "tsgo" port) adopts 6.0's new defaults and only
 * changes a small number of fields on top of them, so this file encodes just
 * the delta over `applyV6Defaults`; the shared v6 defaults (`strict`, `target`,
 * `types: []`, `rootDir`, `libReplacement: false`,
 * `noUncheckedSideEffectImports`, `alwaysStrict`) still flow through the
 * cumulative v6 pass in `applyVersionDefaults`.
 * @see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
 */
// eslint-disable-next-line import/prefer-default-export
export const applyV7Defaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>): void => {
    // module: v7 defaults to `esnext` unconditionally. In v6 this was *derived*
    // as `es2022` from the default `target: es2025`; v7 pins it to `esnext`.
    if (!userSet.has("module")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.module = "esnext";
    }

    // moduleResolution: `esnext` is a non-Node module, so v7 still derives
    // `bundler`. Restated here so applying v7 in isolation stays consistent
    // with the module override above.
    if (!userSet.has("moduleResolution")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.moduleResolution = "bundler";
    }

    // stableTypeOrdering: new in v7, defaults to true and cannot be disabled.
    // type-fest does not model this option yet; cast through a local shape.
    if (!userSet.has("stableTypeOrdering")) {
        // eslint-disable-next-line no-param-reassign
        (compilerOptions as { stableTypeOrdering?: boolean }).stableTypeOrdering = true;
    }
};
