/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

import { applyModuleAndTargetDefaults } from "./shared";

/**
 * TypeScript 6.0 default-flips.
 *
 * Note on `module` / `moduleResolution` / `target`: these remain *derived* from
 * each other in v6. `applyModuleAndTargetDefaults` reproduces that derivation —
 * the default `target: es2025` + `module: es2022` + `moduleResolution: bundler`
 * applies only when no user-set Node-style `module`/`moduleResolution` pins the
 * fields to the values `tsc` derives (e.g. `module: nodenext` ⇒
 * `moduleResolution: nodenext`, `target: esnext`).
 */
// eslint-disable-next-line import/prefer-default-export
export const applyV6Defaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>): void => {
    // strict: defaults to true (the implicit-strict flip in TS 6).
    if (!userSet.has("strict")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.strict = true;
    }

    // target/module/moduleResolution: v6 defaults to es2025 + es2022 + bundler,
    // unless a user-set Node-style module (or moduleResolution) dictates them.
    // type-fest does not yet model 'es2025'; the union accepts it as a string.
    applyModuleAndTargetDefaults(compilerOptions, userSet, { module: "es2022", target: "es2025" });

    // rootDir: when a `configFilePath` is present, v6 always uses the tsconfig
    // directory as rootDir — previously this only happened for `composite: true`.
    if (!userSet.has("rootDir")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.rootDir = ".";
    }

    // types: defaults to [] (no @types auto-discovery). Auto-discovery is now
    // opt-in via `types: ["*"]`.
    if (!userSet.has("types")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.types = [];
    }

    // noUncheckedSideEffectImports: defaults to true.
    if (!userSet.has("noUncheckedSideEffectImports")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.noUncheckedSideEffectImports = true;
    }

    // libReplacement: defaults to false (was true in 5.x).
    if (!userSet.has("libReplacement")) {
        // eslint-disable-next-line no-param-reassign
        (compilerOptions as { libReplacement?: boolean }).libReplacement = false;
    }

    // alwaysStrict is decoupled from strict-family in v6 — defaults to true
    // unconditionally, regardless of whether `strict` is set/false.
    if (!userSet.has("alwaysStrict")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.alwaysStrict = true;
    }
};
