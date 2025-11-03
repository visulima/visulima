import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

// Detailed error logging with code frames and stack traces
const cli = new Cerebro("cerebro-errors");

cli.addPlugin(
    errorHandlerPlugin({
        detailed: true,
    }),
);

cli.addCommand({
    description: "Demonstrate detailed error handling with code frames and stack traces",
    execute: () => {
        const error = new Error("Detailed error with additional context");

        error.code = "ERR_DEMO";
        error.statusCode = 500;
        error.context = { action: "test", userId: 123 };

        throw error;
    },
    name: "error-detailed",
});

await cli.run({ argv: ["error-detailed"] });

