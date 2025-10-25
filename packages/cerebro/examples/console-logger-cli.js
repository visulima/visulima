import { Cerebro } from "@visulima/cerebro";
import { consoleLoggerPlugin } from "@visulima/cerebro/plugins/console-logger";
import { pailLoggerPlugin } from "@visulima/cerebro/plugins/pail-logger";

// Get the logger type from environment variable
const loggerType = process.env.LOGGER_TYPE || "console"; // "console" or "pail"

const cli = new Cerebro("logger-example");

// Add the appropriate logger plugin
if (loggerType === "pail") {
    console.log("Using Pail logger (full-featured, slower)\n");
    cli.addPlugin(pailLoggerPlugin());
} else {
    console.log("Using Console logger (lightweight, faster)\n");
    cli.addPlugin(consoleLoggerPlugin());
}

// Add a test command that uses various log levels
cli.addCommand({
    description: "Test all log levels",
    execute: ({ logger }) => {
        logger.debug("This is a debug message");
        logger.info("This is an info message");
        logger.log("This is a log message");
        logger.warn("This is a warning");
        logger.error("This is an error");
        logger.success("This is a success message");
    },
    name: "test-logging",
});

await cli.run();
