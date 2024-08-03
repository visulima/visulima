import Cli from "@visulima/cerebro";

// Create a CLI runtime
const cli = new Cli("cerebro");

// Your command
cli.addCommand({
    name: "main:colors",
    description: "Output colors", // This is used in the help output
    execute: ({ logger }) => {
        logger.info("Colors command");
    },
});

await cli.run();
