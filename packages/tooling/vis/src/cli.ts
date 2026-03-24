import { createCerebro as createCli } from "@visulima/cerebro";

import { runCommand } from "./commands/run";
import { graphCommand } from "./commands/graph";
import { affectedCommand } from "./commands/affected";

const VERSION = "0.0.1";

const createCerebro = () => {
    const cli = createCli("vis", {
        packageName: "@visulima/vis",
        packageVersion: VERSION,
    });

    cli.addCommand(runCommand);
    cli.addCommand(graphCommand);
    cli.addCommand(affectedCommand);

    return cli;
};

export { createCerebro };
