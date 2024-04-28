import type { Cli } from "@visulima/cerebro";

import createBundler from "../create-bundler";
import type { Mode } from "../types";

const createBuildCommand = (cli: Cli): void => {
    cli.addCommand({
        description: "Demonstrate options required",
        execute: async ({ options }): Promise<void> => {
            let mode: Mode = "build";

            if (options.watch) {
                mode = "watch";
            } else if (options.jit) {
                mode = "jit";
            }

            const environments: Record<string, string> = {};

            if (options.env) {
                // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                for (const environment of options.env) {
                    environments[environment.key] = environment.value;
                }
            }

            await createBundler(options.dir, mode, {
                cjsInterop: options.cjsInterop,
                configPath: options.config ?? undefined,
                debug: options.debug,
                replace: {
                    ...environments,
                },
                rollup: {
                    esbuild: {
                        minify: options.minify,
                        target: options.target,
                    },
                    license: {
                        path: options.license,
                    },
                    metafile: options.metafile,
                    ...(options.analyze ? { visualizer: {} } : { visualizer: false }),
                },
                sourcemap: options.sourcemap,
                tsconfigPath: options.tsconfig ?? undefined,
            });
        },
        name: "build",
        options: [
            {
                defaultValue: ".",
                description: "The directory to build",
                name: "dir",
                type: String,
            },
            {
                alias: "t",
                description: "Environments to support. `target` in tsconfig.json is automatically added. Defaults to the current Node.js version.",
                name: "target",
            },
            {
                description: "Use a custom config file",
                name: "config",
                type: String,
            },
            {
                description: "Path to the tsconfig.json file",
                name: "tsconfig",
                type: String,
            },
            {
                description: "Minify the output",
                name: "minify",
                type: Boolean,
            },
            {
                description: "Generate sourcemaps (experimental)",
                name: "sourcemap",
                type: Boolean,
            },
            {
                // conflicts: "jit",
                description: "Watch for changes",
                name: "watch",
                type: Boolean,
            },
            {
                // conflicts: "watch",
                description: "Stub the package for JIT compilation",
                name: "jit",
                type: Boolean,
            },
            {
                description: "Compile-time environment variables (eg. --env.NODE_ENV=production)",
                multiple: true,
                name: "env",
                // @ts-expect-error -- wrong type
                type: (input: string) => {
                    const [key, value] = input.split("=");

                    return {
                        key,
                        value,
                    };
                },
            },
            {
                defaultValue: false,
                description: "Generate meta file (experimental)",
                name: "metafile",
                type: Boolean,
            },
            {
                description: "Path to the license file",
                name: "license",
                type: String,
            },
            {
                conflicts: "watch",
                description: "Visualize and analyze the bundle",
                name: "analyze",
                type: Boolean,
            },
            {
                description: "CJS interop mode, can export default and named export, (experimental).",
                name: "cjsInterop",
                type: Boolean,
            },
        ],
    });
};

export default createBuildCommand;
