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
// eslint-disable-next-line import/exports-last -- shared helper consumed by v4/v5 default appliers; keep it co-located with the constant it wraps
export const moduleDictatesTarget = (module: TsConfigJson.CompilerOptions.Module | undefined): boolean =>
    module !== undefined && MODULES_THAT_DICTATE_TARGET.has(module);

/**
 * The ESNext baseline `target` a Node-style `module` pins: node16/node18 →
 * es2022, node20 → es2023, nodenext → esnext.
 */
const nodeModuleTarget = (module: string): TsConfigJson.CompilerOptions.Target => {
    switch (module) {
        case "node20": {
            return "es2023";
        }
        case "nodenext": {
            return "esnext";
        }
        // node16, node18
        default: {
            return "es2022";
        }
    }
};

/**
 * The `moduleResolution` a Node-style `module` derives: nodenext → nodenext,
 * everything else (node16/node18/node20) → node16.
 */
const nodeModuleResolution = (module: string): TsConfigJson.CompilerOptions.ModuleResolution => {
    if (module === "nodenext") {
        return "nodenext";
    }

    return "node16";
};

/**
 * The Node-style `module` a Node-style `moduleResolution` implies, or
 * `undefined` when the resolution does not demand one.
 */
const resolutionImpliesModule = (resolution: string): TsConfigJson.CompilerOptions.Module | undefined => {
    if (resolution === "nodenext") {
        return "nodenext";
    }

    if (resolution === "node16") {
        return "node16";
    }

    return undefined;
};

/**
 * Applies the v6/v7 `module` / `moduleResolution` / `target` defaults while
 * honouring the cross-field derivation TypeScript performs for Node-style
 * modules.
 *
 * A user-set Node-style `module` (or `moduleResolution`) pins the other two
 * fields to the values `tsc` itself derives, so we never emit the
 * `moduleResolution: bundler` + `module: node*` combination that `tsc` rejects
 * (TS5095). When neither field points at a Node-style module the passed
 * `defaultModule`/`defaultTarget` are used and `moduleResolution` falls back to
 * `bundler`. `target` is only defaulted when `defaultTarget` is provided (v6
 * owns the `target` default; v7 inherits it through the cumulative v6 pass).
 */
export const applyModuleAndTargetDefaults = (
    compilerOptions: TsConfigJson.CompilerOptions,
    userSet: ReadonlySet<string>,
    defaults: { module: TsConfigJson.CompilerOptions.Module; target?: TsConfigJson.CompilerOptions.Target },
): void => {
    const userModule = userSet.has("module") ? compilerOptions.module : undefined;
    const userModuleResolution = userSet.has("moduleResolution") ? compilerOptions.moduleResolution : undefined;

    let nodeModule: TsConfigJson.CompilerOptions.Module | undefined;

    if (userModule !== undefined && MODULES_THAT_DICTATE_TARGET.has(userModule)) {
        nodeModule = userModule;
    } else if (userModuleResolution !== undefined) {
        nodeModule = resolutionImpliesModule(userModuleResolution);
    }

    if (defaults.target !== undefined && !userSet.has("target")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.target = nodeModule ? nodeModuleTarget(nodeModule) : defaults.target;
    }

    if (!userSet.has("module")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.module = nodeModule ?? defaults.module;
    }

    if (!userSet.has("moduleResolution")) {
        // eslint-disable-next-line no-param-reassign
        compilerOptions.moduleResolution = nodeModule ? nodeModuleResolution(nodeModule) : "bundler";
    }
};
