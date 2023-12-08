import Cli from "@visulima/cerebro";

import optionsConflicts from "./commands/options-conflicts.js";

const cli = new Cli("cerebro");

optionsConflicts(cli);

await cli.run();
