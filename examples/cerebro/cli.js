import Cli from "@visulima/cerebro";

import optionsDefault from "./commands/options-defaults.js";
import optionsConflicts from "./commands/options-conflicts.js";
import optionsCommon from "./commands/options-common.js";
import optionsNegatable from "./commands/options-negatable.js";
import optionsImplies from "./commands/options-implies.js";

const cli = new Cli("cerebro");

optionsCommon(cli);
optionsConflicts(cli);
optionsDefault(cli);
optionsNegatable(cli);
optionsImplies(cli);

await cli.run();
