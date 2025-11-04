import { Cerebro } from "@visulima/cerebro";

// Main CLI that shows available examples
const cli = new Cerebro("cerebro-errors");

cli.addCommand({
    description: "Show available error handling examples",
    execute: ({ logger }) => {
        logger.info("Available error handling examples:");
        logger.info("");
        logger.info("  node cli-simple.js");
        logger.info("    → Default error handling");
        logger.info("");
        logger.info("  node cli-detailed.js");
        logger.info("    → Detailed error logging with code frames and stack traces");
        logger.info("");
        logger.info("  node cli-custom-formatter.js");
        logger.info("    → Custom error formatting");
        logger.info("");
        logger.info("  node cli-render-options.js");
        logger.info("    → Custom renderError options");
    },
    name: "examples",
});

await cli.run();
