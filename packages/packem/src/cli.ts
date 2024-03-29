import Cli from "@visulima/cerebro";

import { name, version } from "../package.json";
import { createBundler } from "./create-bundler";

const cli = new Cli("packem", {
    packageName: name,
    packageVersion: version,
});

cli.addCommand({
    description: "Demonstrate options required",
    execute: async ({ options }): Promise<void> => {
        await createBundler(options.dir ?? ".", false, {
            rollup: {
                esbuild: {
                    minify: options.minify,
                    target: options.target,
                },
            },
            sourcemap: options.sourcemap,
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
            description: "Compile-time environment variables (eg. --env.NODE_ENV=production)",
            name: "env",
            type: (input: string) => {
                const [key, value] = input.split("=");

                return {
                    key,
                    value,
                };
            },
        },
    ],
});

cli.setDefaultCommand("build");

cli.run();
