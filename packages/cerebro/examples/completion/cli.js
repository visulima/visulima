// packages/cerebro/examples/completion.js
import { Cerebro } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";

const cli = new Cerebro("example-cli", {
    packageName: "example-cli",
    packageVersion: "1.0.0",
});

// Add some example commands to demonstrate completion
cli.addCommand({
    name: "build",
    description: "Build the project",
    options: [
        {
            name: "output",
            alias: "o",
            type: String,
            description: "Output directory",
        },
        {
            name: "watch",
            alias: "w",
            type: Boolean,
            description: "Watch for changes",
        },
        {
            name: "minify",
            type: Boolean,
            description: "Minify output",
        },
    ],
    execute: ({ logger, options }) => {
        logger.info(`Building project...`);
        if (options.output) {
            logger.info(`Output directory: ${options.output}`);
        }
        if (options.watch) {
            logger.info("Watching for changes...");
        }
        if (options.minify) {
            logger.info("Minifying output...");
        }
    },
});

cli.addCommand({
    name: "serve",
    description: "Start development server",
    options: [
        {
            name: "port",
            alias: "p",
            type: Number,
            description: "Port number",
        },
        {
            name: "host",
            alias: "h",
            type: String,
            description: "Host address",
        },
    ],
    execute: ({ logger, options }) => {
        const port = options.port || 3000;
        const host = options.host || "localhost";
        logger.info(`Starting server on ${host}:${port}...`);
    },
});

cli.addCommand({
    name: "test",
    description: "Run tests",
    options: [
        {
            name: "coverage",
            alias: "c",
            type: Boolean,
            description: "Generate coverage report",
        },
        {
            name: "watch",
            alias: "w",
            type: Boolean,
            description: "Watch mode",
        },
    ],
    execute: ({ logger, options }) => {
        logger.info("Running tests...");
        if (options.coverage) {
            logger.info("Generating coverage report...");
        }
        if (options.watch) {
            logger.info("Watching for changes...");
        }
    },
});

// Add the completion command
cli.addCommand(completionCommand);

// Run the CLI
await cli.run();

