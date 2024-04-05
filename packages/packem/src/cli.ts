import { exit } from "node:process";

import Cli from "@visulima/cerebro";

import { name, version } from "../package.json";
import createBundler from "./create-bundler";
import type { Mode } from "./types";

const cli = new Cli("packem", {
    packageName: name,
    packageVersion: version,
});

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
    ],
});

cli.setDefaultCommand("build");

// eslint-disable-next-line unicorn/prefer-top-level-await,@typescript-eslint/no-explicit-any
cli.run().catch((error: any) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
    exit(1);
});
