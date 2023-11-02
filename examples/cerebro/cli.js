import Cli from "@visulima/cerebro";

import colorsCommand from "./commands/colors.js";

const cli = new Cli("cerebro");

//cli.addCommand(colorsCommand);

await cli.run();
