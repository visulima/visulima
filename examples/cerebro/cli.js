import Cli from "@visulima/cerebro";

import colorsCommand from "./commands/colors.js";

(async () => {
    try {
        // Create a CLI runtime
        const cli = new Cli("cerebro");

        cli.addCommand(colorsCommand);

        await cli.run();
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
