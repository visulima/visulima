import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

/**
 * This package declares `"sideEffects": false`, and consumers bundle it on that promise. Keeping
 * that promise means shipping chunks whose *module scope* never reaches into Node core — see
 * `src/util/node-builtin.ts` for why, and `__tests__/integration/dist-node-interop.test.ts` for the
 * guard on the built output.
 *
 * That is a source-level property here, so this config needs nothing to enforce it. It used to:
 * with `node:*` imports at module scope, `requireCJS.builtinNodeModules` rewrote each one into a
 * module-scope `__cjs_getBuiltinModule` call backed by a static `import { createRequire } from
 * "node:module"`, and a plugin then rewrote *that* back out of every chunk. The rewrite was pinned
 * to one packem version's preamble, and the `@__PURE__` annotations it added to make the remaining
 * lookups droppable did not survive a consumer whose own build minifies before it tree-shakes — so
 * the chunks came back anyway. Reaching for the builtin inside the function that needs it removes
 * the module-scope statement instead of trying to make bundlers discard it.
 */

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
    //
}) as BuildConfig;
