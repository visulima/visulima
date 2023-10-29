import Cli from "@visulima/cerebro";

import pkg from "./package.json" assert { type: 'json' };
import colorsCommand from "./commands/colors.js";

(async () => {
    try {
        // Create a CLI runtime
        const cli = new Cli("cerebro", pkg.name, pkg.version);

        cli.addCommand(colorsCommand);

        return await cli.run();
    } catch (error) {
        // Abort via CTRL-C
        if (!error) {
            console.log("Goodbye ✌️");
        } else {
            // Throw error
            throw error;
        }
    }
})();
