/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

import { applyModuleAndTargetDefaults } from "./shared";

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
    // module: v7 defaults to `esnext` (v6 derived `es2022`); moduleResolution
    // stays `bundler` for the non-Node default. A user-set Node-style module (or
    // moduleResolution) still pins both, matching what `tsc` derives. `target`
    // is left to the cumulative v6 pass, so it is not defaulted here again.
    applyModuleAndTargetDefaults(compilerOptions, userSet, { module: "esnext" });

    // stableTypeOrdering: new in v7, defaults to true and cannot be disabled.
    // type-fest does not model this option yet; cast through a local shape.
    if (!userSet.has("stableTypeOrdering")) {
        // eslint-disable-next-line no-param-reassign
        (compilerOptions as { stableTypeOrdering?: boolean }).stableTypeOrdering = true;
    }
};
