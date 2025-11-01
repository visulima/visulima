import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";
import { pailLoggerPlugin } from "@visulima/cerebro/plugins/pail-logger";

import errorCritical from "./error-critical.js";
import errorCustomFormatter from "./error-custom-formatter.js";
import errorDetailed from "./error-detailed.js";
import errorSimple from "./error-simple.js";

// Get configuration from command line argument
const mode = process.argv[2];

const cli = new Cerebro("cerebro-errors");

// Configure different error handling modes
switch (mode) {
    case "error-critical": {
    // Critical level logging for severe errors
        cli.addPlugin(pailLoggerPlugin());
        cli.addPlugin(
            errorHandlerPlugin({
                detailed: true,
                useCriticalLevel: true,
            }),
        );

        errorCritical(cli);

        break;
    }
    case "error-custom-formatter": {
    // Custom error formatting
        cli.addPlugin(pailLoggerPlugin());
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
║ Type:      ${error.name}
${error.code ? `║ Code:      ${error.code}` : ""}
╚════════════════════════════════════════════════════════════`;
                },
            }),
        );

        errorCustomFormatter(cli);

        break;
    }
    case "error-detailed": {
    // Detailed error logging with stack traces and additional properties
        cli.addPlugin(pailLoggerPlugin());
        cli.addPlugin(
            errorHandlerPlugin({
                detailed: true,
            }),
        );

        errorDetailed(cli);

        break;
    }
    case "error-simple": {
    // Default error handling
        cli.addPlugin(pailLoggerPlugin());
        cli.addPlugin(errorHandlerPlugin());
        errorSimple(cli);

        break;
    }
    default: {
    // Show all available modes
        cli.addPlugin(pailLoggerPlugin());
        cli.addCommand({
            description: "Show available error handling examples",
            execute: ({ logger }) => {
                logger.info("Available error handling examples:");
                logger.info("");
                logger.info("  node error-handler-cli.js error-simple");
                logger.info("    → Default error handling");
                logger.info("");
                logger.info("  node error-handler-cli.js error-detailed");
                logger.info("    → Detailed error logging with stack traces");
                logger.info("");
                logger.info("  node error-handler-cli.js error-critical");
                logger.info("    → Critical level error logging");
                logger.info("");
                logger.info("  node error-handler-cli.js error-custom-formatter");
                logger.info("    → Custom error formatting");
            },
            name: "examples",
        });
    }
}

await cli.run();
