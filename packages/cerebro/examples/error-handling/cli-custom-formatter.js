import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

// Custom error formatting
const cli = new Cerebro("cerebro-errors");

cli.addPlugin(
    errorHandlerPlugin({
        formatter: (error) => {
            const errorId = error.errorId || "UNKNOWN";
            const timestamp = error.timestamp || new Date().toISOString();

            return `
╔════════════════════════════════════════════════════════════
║ 🚨 ERROR REPORT
╠════════════════════════════════════════════════════════════
║ Error ID:  ${errorId}
║ Timestamp: ${timestamp}
║ Message:   ${error.message}
║ Type:      ${error.name}${error.code ? `\n║ Code:      ${error.code}` : ""}
╚════════════════════════════════════════════════════════════`;
        },
    }),
);

cli.addCommand({
    description: "Demonstrate custom error formatting",
    execute: () => {
        const error = new Error("Error with custom formatting");

        error.errorId = "ERR-2024-001";
        error.timestamp = new Date().toISOString();

        throw error;
    },
    name: "error-custom-formatter",
});

await cli.run({ argv: ["error-custom-formatter"] });
