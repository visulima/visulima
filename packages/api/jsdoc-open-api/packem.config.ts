import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    // webpack is an optional peer (only used by the webpack plugin entry). It uses
    // `export = exports` CJS-namespace types which neither rollup-plugin-dts nor
    // oxc's dts bundler can inline — leave it external so the emitted .d.ts files
    // keep `import("webpack").Compiler` references intact.
    externals: ["webpack"],
    node10Compatibility: {
        writeToPackageJson: true,
        typeScriptVersion: ">=5.0",
    },
    rollup: {
        // oxc dts path in @visulima/rollup-plugin-dts@1.0.0-alpha.12 crashes in
        // `fake-js` (`Cannot read properties of undefined (reading 'decl')`) on
        // this entry — stay on the tsc-based dts builder until fixed upstream.
        dynamicVars: false,
        license: {
            path: "./LICENSE.md",
        },
    },
    transformer,
}) as BuildConfig;
