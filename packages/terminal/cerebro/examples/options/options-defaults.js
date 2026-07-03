// Try the following:
//    node cli.js options-defaults
//    node cli.js options-defaults --cheese stilton
const optionsDefault = (cli) => {
    cli.addCommand({
        execute: ({ logger, options }) => {
            logger.log(`Cheese: ${options.cheese}`);
        },
        group: "options",
        name: "options-defaults",
        options: [
            {
                defaultValue: "blue",
                description: "Add the specified type of cheese",
                name: "cheese",
                type: String,
            },
        ],
    });
};

export default optionsDefault;
