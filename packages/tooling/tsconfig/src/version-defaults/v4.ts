/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

import { moduleDictatesTarget } from "./shared";

/**
 * TypeScript 4.x unconditional defaults.
 *
 * Almost everything TS 4 synthesizes is *derived* from other options
 * (`module` from `target`, `moduleResolution` from `module`, etc.) — those
 * derivations are handled in `tsCompatibleWrapper` and are not encoded here.
 * Only fields with a true unconditional fallback live in this file.
 */
// eslint-disable-next-line import/prefer-default-export
export const applyV4Defaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>): void => {
    // target: ES3 fallback only when no module dictates a different target.
    // https://github.com/microsoft/TypeScript/blob/v4.9.5/src/compiler/utilities.ts#L6361-L6366
    if (!userSet.has("target") && !moduleDictatesTarget(compilerOptions.module)) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.target = "es3";
    }
};
