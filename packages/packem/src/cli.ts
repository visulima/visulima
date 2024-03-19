import Cli from "@visulima/cerebro";
import { resolve } from "pathe";

import { name, version } from "../package.json";
import { createBundler } from "./create-bundler";

const cli = new Cli("packem", {
    packageName: name,
    packageVersion: version,
});

cli.addCommand({
    description: "Demonstrate options required",
    execute: async ({ logger, options }): Promise<void> => {
        // const rootDir = resolve(process.cwd(), args.dir || ".");

        await createBundler(options.dir);
    },
    name: "build",
    options: [
        {
            defaultValue: ".",
            description: "The directory to build",
            name: "dir",
            type: String,
        },
    ],
});

await cli.run();
