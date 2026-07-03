/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

import { moduleDictatesTarget } from "./shared";

/**
 * TypeScript 5.x unconditional defaults.
 *
 * The only delta from v4 is the `target` fallback bumping from ES3 to ES5.
 * All module/moduleResolution/strict behaviour is unchanged in TS 5 and still
 * flows through the existing derivation logic in `tsCompatibleWrapper`.
 */
// eslint-disable-next-line import/prefer-default-export
export const applyV5Defaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>): void => {
    // target: ES5 fallback (was ES3 in v4) — but only when module doesn't
    // dictate a different target.
    // https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/utilities.ts#L8969-L8980
    if (!userSet.has("target") && !moduleDictatesTarget(compilerOptions.module)) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.target = "es5";
    }
};
