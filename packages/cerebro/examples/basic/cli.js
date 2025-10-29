// packages/cerebro/examples/basic/cli.js
// A simple example demonstrating basic Cerebro CLI usage
import { Cerebro } from "@visulima/cerebro";

const cli = new Cerebro("my-app", {
    packageName: "my-app",
    packageVersion: "1.0.0",
});

cli.addCommand({
    name: "hello",
    description: "Say hello to someone",
    argument: {
        name: "name",
        description: "Name to greet",
        type: String,
        defaultValue: "World",
    },
    options: [
        {
            name: "greeting",
            alias: "g",
            type: String,
            description: "Custom greeting",
            defaultValue: "Hello",
        },
    ],
    execute: ({ argument, logger, options }) => {
        const name = argument?.[0] || "World";
        logger.info(`${options.greeting}, ${name}!`);
    },
});

cli.addCommand({
    name: "goodbye",
    description: "Say goodbye",
    execute: ({ logger }) => {
        logger.info("Goodbye!");
    },
});

await cli.run();

