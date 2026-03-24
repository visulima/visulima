import module from "node:module";

import { createCerebro } from "@visulima/cerebro";

import pkg from "../package.json";
import affectedCommand from "./commands/affected";
import graphCommand from "./commands/graph";
import hookCommand from "./commands/hook";
import runCommand from "./commands/run";

if (module.enableCompileCache) {
    module.enableCompileCache();
}

const cli = createCerebro("vis", {
    packageName: "vis",
    packageVersion: pkg.version,
});

cli.addCommand(runCommand);
cli.addCommand(graphCommand);
cli.addCommand(affectedCommand);
cli.addCommand(hookCommand);

await cli.run();
