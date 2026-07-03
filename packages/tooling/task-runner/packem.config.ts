import type { BuildConfig } from "@visulima/packem/config";
import { defineConfig } from "@visulima/packem/config";
import transformer from "@visulima/packem/transformer/esbuild";

// eslint-disable-next-line import/no-unused-modules
export default defineConfig({
    rollup: {
        dts: {
            oxc: true,
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
        dependencies: {
            unused: {
                exclude: [
                    "@visulima/task-runner-binding-darwin-arm64",
                    "@visulima/task-runner-binding-darwin-x64",
                    "@visulima/task-runner-binding-linux-arm64-gnu",
                    "@visulima/task-runner-binding-linux-arm64-musl",
                    "@visulima/task-runner-binding-linux-x64-gnu",
                    "@visulima/task-runner-binding-linux-x64-musl",
                    "@visulima/task-runner-binding-win32-arm64-msvc",
                    "@visulima/task-runner-binding-win32-x64-msvc",
                    "@lydell/node-pty",
                ],
            },
        },
    },
}) as BuildConfig;
