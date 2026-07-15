/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

import { applyV4Defaults } from "./v4";
import { applyV5Defaults } from "./v5";
import { applyV6Defaults } from "./v6";
import { applyV7Defaults } from "./v7";

type ApplyVersionDefaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>) => void;

/**
 * Ordered list of TypeScript major versions and their default-flips.
 *
 * Cumulative semantics: every entry whose major is less than or equal to the
 * target version is applied, in ascending order.
 */
const versionDeltas: ReadonlyArray<readonly [number, ApplyVersionDefaults]> = [
    [4, applyV4Defaults],
    [5, applyV5Defaults],
    [6, applyV6Defaults],
    [7, applyV7Defaults],
];

const VERSION_REGEX = /^v?(\d+)/;

const parseMajor = (version: string): number | undefined => {
    const match = VERSION_REGEX.exec(version);

    return match ? Number(match[1]) : undefined;
};

/**
 * Apply unconditional compiler-option defaults that TypeScript would synthesize
 * at runtime, based on the target TypeScript version.
 *
 * Distinct from the *derived* defaults handled in `tsCompatibleWrapper` (e.g.
 * `module: nodenext` ⇒ `moduleResolution: nodenext`), which are always applied
 * because they are internally consistent within a single tsconfig.
 */
// eslint-disable-next-line import/prefer-default-export
export const applyVersionDefaults = (compilerOptions: TsConfigJson.CompilerOptions, typescriptVersion: string): void => {
    const major = parseMajor(typescriptVersion);

    if (major === undefined) {
        return;
    }

    // Snapshot the user's explicit fields *before* any deltas run, so later
    // majors can overwrite earlier majors' defaults without clobbering values
    // the user actually set.
    const userSet: ReadonlySet<string> = new Set(Object.keys(compilerOptions));

    for (const [version, apply] of versionDeltas) {
        if (version <= major) {
            apply(compilerOptions, userSet);
        }
    }
};
