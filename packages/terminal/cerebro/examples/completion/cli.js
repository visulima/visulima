import { Cerebro } from "@visulima/cerebro";
import completionCommand from "@visulima/cerebro/command/completion";

const cli = new Cerebro("example-cli", {
    packageName: "example-cli",
    packageVersion: "1.0.0",
});

// Add some example commands to demonstrate completion
cli.addCommand({
    description: "Build the project",
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
    name: "build",
    options: [
        {
            alias: "o",
            description: "Output directory",
            name: "output",
            type: String,
        },
        {
            alias: "w",
            description: "Watch for changes",
            name: "watch",
            type: Boolean,
        },
        {
            description: "Minify output",
            name: "minify",
            type: Boolean,
        },
    ],
});

cli.addCommand({
    description: "Start development server",
    execute: ({ logger, options }) => {
        const port = options.port || 3000;
        const host = options.host || "localhost";

        logger.info(`Starting server on ${host}:${port}...`);
    },
    name: "serve",
    options: [
        {
            alias: "p",
            description: "Port number",
            name: "port",
            type: Number,
        },
        {
            alias: "h",
            description: "Host address",
            name: "host",
            type: String,
        },
    ],
});

cli.addCommand({
    description: "Run tests",
    execute: ({ logger, options }) => {
        logger.info("Running tests...");

        if (options.coverage) {
            logger.info("Generating coverage report...");
        }

        if (options.watch) {
            logger.info("Watching for changes...");
        }
    },
    name: "test",
    options: [
        {
            alias: "c",
            description: "Generate coverage report",
            name: "coverage",
            type: Boolean,
        },
        {
            alias: "w",
            description: "Watch mode",
            name: "watch",
            type: Boolean,
        },
    ],
});

// Add the completion command
cli.addCommand(completionCommand);

// Run the CLI
await cli.run();
