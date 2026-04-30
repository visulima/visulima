/**
 * A modified version from `https://github.com/privatenumber/get-tsconfig`
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
import type { TsConfigJson } from "type-fest";

/**
 * TypeScript 6.0 default-flips.
 *
 * Note on `module` / `moduleResolution`: in v6 these remain *derived* from
 * `target` (and from each other) — the values below are correct when the v6
 * default `target: es2025` is also in effect (the most common path for a
 * parsed config). When the user sets a non-default `target`, the cross-field
 * derivation handled by `tsCompatibleWrapper` still applies pre-v6 rules.
 */
// eslint-disable-next-line import/prefer-default-export
export const applyV6Defaults = (compilerOptions: TsConfigJson.CompilerOptions, userSet: ReadonlySet<string>): void => {
    // strict: defaults to true (the implicit-strict flip in TS 6).
    if (!userSet.has("strict")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.strict = true;
    }

    // target: defaults to the latest stable ES year (es2025 in v6.0).
    if (!userSet.has("target")) {
        // type-fest does not yet model 'es2025'; cast through the union.
        // eslint-disable-next-line no-param-reassign
        compilerOptions.target = "es2025" as TsConfigJson.CompilerOptions.Target;
    }

    // module: with target=es2025 (≥es2022), v6 derives module=es2022.
    if (!userSet.has("module")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.module = "es2022";
    }

    // moduleResolution: with module=es2022 (non-Node), v6 derives bundler.
    if (!userSet.has("moduleResolution")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.moduleResolution = "bundler";
    }

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
