import { exit } from "node:process";

import Cli from "@visulima/cerebro";

import { name, version } from "../package.json";
import createBuildCommand from "./commands/build";

const cli = new Cli("packem", {
    packageName: name,
    packageVersion: version,
});

createBuildCommand(cli);

cli.setDefaultCommand("build");

// eslint-disable-next-line unicorn/prefer-top-level-await,@typescript-eslint/no-explicit-any
cli.run().catch((error: any) => {
    // eslint-disable-next-line no-console
    console.error(error.message);
    exit(1);
});
