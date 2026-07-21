import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    rollup: {
        dts: {
            oxc: true,
        },
        license: {
            path: "./LICENSE.md",
        },
    },
    transformer,
    cjsInterop: true,
    validation: {
        packageJson: {
            // The deep per-component subpath layout is intentional and not
            // derivable by packem alone; `pnpm run lint:exports` covers it.
            exports: false,
        },
    },
}) as BuildConfig;
