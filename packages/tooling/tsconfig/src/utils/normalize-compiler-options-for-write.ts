import type { TsConfigJson } from "type-fest";

/**
 * A resolved `CompilerOptions` object (the value TypeScript's compiler API produces and consumes)
 * stores enum options **numerically** — `target: 99` is `ScriptTarget.ESNext`, `moduleResolution: 100`
 * is `ModuleResolutionKind.Bundler`. A `tsconfig.json`, however, must spell those out as their string
 * names (`"esnext"`, `"bundler"`); the tsconfig JSON parser rejects a bare number with
 * `TS5024: Compiler option '…' requires a value of type enum`.
 *
 * These ordinals are part of TypeScript's on-disk `.tsbuildinfo` format and are therefore effectively
 * frozen, so mapping them back with a static table is safe.
 */
const SCRIPT_TARGET_NAMES: Record<number, string> = {
    0: "es3",
    1: "es5",
    2: "es2015",
    3: "es2016",
    4: "es2017",
    5: "es2018",
    6: "es2019",
    7: "es2020",
    8: "es2021",
    9: "es2022",
    10: "es2023",
    11: "es2024",
    99: "esnext",
};

const MODULE_KIND_NAMES: Record<number, string> = {
    0: "none",
    1: "commonjs",
    2: "amd",
    3: "umd",
    4: "system",
    5: "es2015",
    6: "es2020",
    7: "es2022",
    99: "esnext",
    100: "node16",
    101: "node18",
    199: "nodenext",
    200: "preserve",
};

const MODULE_RESOLUTION_NAMES: Record<number, string> = {
    1: "classic",
    2: "node10",
    3: "node16",
    99: "nodenext",
    100: "bundler",
};

const JSX_NAMES: Record<number, string> = {
    1: "preserve",
    2: "react-native",
    3: "react",
    4: "react-jsx",
    5: "react-jsxdev",
};

const MODULE_DETECTION_NAMES: Record<number, string> = {
    1: "legacy",
    2: "auto",
    3: "force",
};

const NEW_LINE_NAMES: Record<number, string> = {
    0: "crlf",
    1: "lf",
};

const ENUM_OPTION_NAMES: Record<string, Record<number, string>> = {
    jsx: JSX_NAMES,
    module: MODULE_KIND_NAMES,
    moduleDetection: MODULE_DETECTION_NAMES,
    moduleResolution: MODULE_RESOLUTION_NAMES,
    newLine: NEW_LINE_NAMES,
    target: SCRIPT_TARGET_NAMES,
};

/**
 * Compiler options removed in TypeScript 7.0 (the native "tsgo" compiler). A TS 5/6 tsconfig can still
 * carry them (they are ignored there), but the TS7 native compiler hard-errors — e.g.
 * `TS5102: Option 'baseUrl' has been removed`. Keyed by the removing TypeScript major so
 * {@link normalizeCompilerOptionsForWrite} can drop only what the requested target version removed.
 */
const REMOVED_COMPILER_OPTIONS_BY_MAJOR: Readonly<Record<number, ReadonlySet<string>>> = {
    7: new Set<string>([
        "baseUrl",
        "charset",
        "importsNotUsedAsValues",
        "keyofStringsOnly",
        "noImplicitUseStrict",
        "noStrictGenericChecks",
        "out",
        "prepend",
        "preserveValueImports",
        "suppressExcessPropertyErrors",
        "suppressImplicitAnyIndexErrors",
    ]),
};

/**
 * Union of every compiler-option name removed at or below the requested TypeScript major, or
 * `undefined` when no major was requested (nothing is dropped).
 */
const resolveRemovedOptions = (removedForMajor: number | undefined): ReadonlySet<string> | undefined => {
    if (removedForMajor === undefined) {
        return undefined;
    }

    let removed: ReadonlySet<string> | undefined;

    for (const [major, set] of Object.entries(REMOVED_COMPILER_OPTIONS_BY_MAJOR)) {
        if (removedForMajor >= Number(major)) {
            removed = removed ? new Set([...removed, ...set]) : set;
        }
    }

    return removed;
};

export interface NormalizeCompilerOptionsForWriteOptions {
    /**
     * When set, drop compiler options removed at or below this TypeScript major version. For example
     * `7` strips `baseUrl` (and the other TS7-removed options) so the written config is accepted by
     * the TypeScript 7 native compiler.
     */
    removedForMajor?: number;
}

/**
 * Normalize a resolved `compilerOptions` object into a shape a `tsconfig.json` parser accepts:
 *
 * - numeric enum values (`target: 99`, `moduleResolution: 100`) become their canonical string names (`"esnext"`, `"bundler"`);
 * - options removed in the requested TypeScript major (see {@link NormalizeCompilerOptionsForWriteOptions.removedForMajor}) are dropped.
 *
 * Values that are already valid — the common case for a hand-written config — pass through untouched.
 * A new object is returned; the input is not mutated.
 */
export const normalizeCompilerOptionsForWrite = (
    compilerOptions: TsConfigJson.CompilerOptions,
    options: NormalizeCompilerOptionsForWriteOptions = {},
): TsConfigJson.CompilerOptions => {
    const removed = resolveRemovedOptions(options.removedForMajor);

    // Spread (not a fresh `{}` + `Object.entries`) so own symbol keys — notably the
    // `implicitBaseUrlSymbol` sentinel — survive normalisation; only the string-keyed enum options
    // and removed options are rewritten below.
    const result: Record<string, unknown> = { ...compilerOptions };

    for (const [key, value] of Object.entries(compilerOptions)) {
        if (removed?.has(key)) {
            delete result[key];

            continue;
        }

        const enumNames = ENUM_OPTION_NAMES[key];

        if (enumNames && typeof value === "number") {
            const name = enumNames[value];

            // An unknown ordinal (e.g. a newer enum member this table predates) is better dropped than
            // emitted as an invalid number the tsconfig parser would reject outright.
            if (name === undefined) {
                delete result[key];
            } else {
                result[key] = name;
            }
        }
    }

    return result;
};
