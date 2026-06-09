import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import tailwindcssLoader from "@visulima/packem/css/loader/tailwindcss";
import cssnanoMinifier from "@visulima/packem/css/minifier/cssnano";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    runtime: "node",
    externals: [/^@visulima\/vis(\/|$)/],
    rollup: {
        resolveExternals: {
            // Force-bundle the entire React renderer stack into vis so that vis's own
            // components, @visulima/tui (which declares react/react-reconciler as peers),
            // and react-reconciler all close over a SINGLE inlined React module. Leaving
            // any of them external lets node resolve a second React copy at runtime, which
            // surfaces as "Invalid hook call ... more than one copy of React". The packages
            // stay declared in package.json so their transitive runtime deps (yoga-layout,
            // scheduler, …) still install — only the inlined copies are actually executed.
            exclude: [
                "@visulima/tabular",
                /^@visulima\/tabular(\/|$)/,
                "react",
                /^react\//,
                "react-reconciler",
                /^react-reconciler(\/|$)/,
                "@visulima/tui",
                /^@visulima\/tui(\/|$)/,
            ],
        },
        css: {
            mode: "inline",
            loaders: [tailwindcssLoader],
            minifier: cssnanoMinifier,
        },
        dts: {
            oxc: true,
        },
        // The release changelog loader uses a runtime-resolved `import(url)` to
        // load a user-supplied formatter module. The default
        // @rollup/plugin-dynamic-import-vars rejects that pattern as
        // statically un-analyzable, so we downgrade its errors to warnings —
        // the variable import survives untransformed and is handled by Node
        // at runtime.
        dynamicVars: {
            warnOnError: true,
        },
        license: {
            path: "./LICENSE.md",
        },
        requireCJS: {
            builtinNodeModules: true,
        },
    },
    transformer,
    cjsInterop: true,
    validation: {
        packageJson: {
            exports: false,
        },
        dependencies: {
            unused: {
                exclude: [
                    "@bomb.sh/tab",
                    "react-reconciler",
                    "smol-toml",
                    // sigma and graphology-types are read at runtime — sigma's UMD bundle is
                    // sliced from node_modules via require.resolve() for the graph HTML
                    // report, graphology-types is a peer of the graph runtime.
                    "sigma",
                    "graphology-types",
                    "@floating-ui/core",
                    "@floating-ui/dom",
                    "@visulima/vis-binding-darwin-arm64",
                    "@visulima/vis-binding-darwin-x64",
                    "@visulima/vis-binding-linux-arm64-gnu",
                    "@visulima/vis-binding-linux-arm64-musl",
                    "@visulima/vis-binding-linux-x64-gnu",
                    "@visulima/vis-binding-linux-x64-musl",
                    "@visulima/vis-binding-win32-arm64-msvc",
                    "@visulima/vis-binding-win32-x64-msvc",
                ],
            },
            hoisted: {
                exclude: [
                    "@antfu/install-pkg",
                    "json5",
                    "normalize-package-data",
                    "@visulima/is-ansi-color-supported",
                    "compromise",
                    "v8-compile-cache",
                    "fastest-levenshtein",
                    "terminal-size",
                    "@jridgewell/trace-mapping",
                    // Pulled in transitively by the now-bundled @visulima/tui renderer.
                    // These stay installed via @visulima/tui (a vis dependency), so the
                    // bundled code resolves them at runtime; the allowlist just silences
                    // packem's shamefully-hoisted warning. The exact set that surfaces
                    // depends on the install's hoisting layout, so list all of tui's
                    // third-party runtime deps. yoga-layout is its layout engine, scheduler
                    // backs react-reconciler, and react-devtools-core/ws are optional
                    // devtools peers lazily required by the reconciler.
                    "yoga-layout",
                    "scheduler",
                    "cli-boxes",
                    "code-excerpt",
                    "patch-console",
                    "signal-exit",
                    "tseep",
                    "react-devtools-core",
                    "ws",
                ],
            },
        },
    },
}) as BuildConfig;
