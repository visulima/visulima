// Try the following:
//    node cli.js options-defaults
//    node cli.js options-defaults --cheese stilton
const optionsDefault = (cli) => {
    cli.addCommand({
        name: "options-defaults",
        group: "options",
        options: [
            {
                name: "cheese",
                description: "Add the specified type of cheese",
                type: String,
                defaultValue: "blue",
            },
        ],
        execute: ({ logger, options }) => {
            logger.log(`Cheese: ${options.cheese}`);
        },
    });
};

export default optionsDefault;
