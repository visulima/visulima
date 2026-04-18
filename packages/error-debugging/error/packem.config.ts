import type { BuildConfig } from "@visulima/packem/config";
import isolatedDeclarationTransformer from "@visulima/packem/dts/isolated/transformer/typescript";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    // TODO: re-enable once the next @visulima/packem release with the Windows-path fix for the
    // isolated-declarations plugin is published. On Windows CI, the plugin currently splices
    // absolute backslash paths into the rewritten import source (e.g. `../util/D:\...\src\util\...`),
    // and TypeScript scans `\u` inside `\util` as a Unicode escape → TS1125. Falling back to
    // packem's default dts generator until the upstream fix lands.
    // isolatedDeclarationTransformer,
}) as BuildConfig;
