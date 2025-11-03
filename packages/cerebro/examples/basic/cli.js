// A simple example demonstrating basic Cerebro CLI usage
import { Cerebro } from "@visulima/cerebro";

const cli = new Cerebro("my-app", {
    packageName: "my-app",
    packageVersion: "1.0.0",
});

cli.addCommand({
    argument: {
        defaultValue: "World",
        description: "Name to greet",
        name: "name",
        type: String,
    },
    description: "Say hello to someone",
    execute: ({ argument, logger, options }) => {
        const name = argument?.[0] || "World";

        logger.info(`${options.greeting}, ${name}!`);
    },
    name: "hello",
    options: [
        {
            alias: "g",
            defaultValue: "Hello",
            description: "Custom greeting",
            name: "greeting",
            type: String,
        },
    ],
});

cli.addCommand({
    description: "Say goodbye",
    execute: ({ logger }) => {
        logger.info("Goodbye!");
    },
    name: "goodbye",
});

await cli.run();
