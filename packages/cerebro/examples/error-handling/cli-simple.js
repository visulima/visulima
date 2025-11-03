import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

// Simple error handling (default behavior)
const cli = new Cerebro("cerebro-errors");

cli.addPlugin(errorHandlerPlugin());

cli.addCommand({
    description: "Demonstrate simple error handling (default behavior)",
    execute: () => {
        throw new Error("This is a simple error message");
    },
    name: "error-simple",
});

await cli.run({ argv: ["error-simple"] });

