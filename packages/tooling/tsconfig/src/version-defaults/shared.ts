/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

const MODULES_THAT_DICTATE_TARGET: ReadonlySet<string> = new Set(["node16", "node18", "node20", "nodenext"]);

/**
 * TS 4.x/5.x set a default `target` only when the user did not pick one *and*
 * the chosen `module` does not already imply a target (Node-style modules
 * pin target to the matching ESNext baseline).
 */
// eslint-disable-next-line import/prefer-default-export
export const moduleDictatesTarget = (module: TsConfigJson.CompilerOptions.Module | undefined): boolean =>
    module !== undefined && MODULES_THAT_DICTATE_TARGET.has(module);
