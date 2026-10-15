import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    // The engine imports no `node:*` module, so the default entry and `./cloudflare` run on Node,
    // Bun and workerd alike. The crontab reader in `src/file.ts` is the one node-bound entry, and the
    // build targets one runtime for the whole package, so that runtime is node.
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
}) as BuildConfig;
