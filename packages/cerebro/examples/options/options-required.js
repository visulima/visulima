// Try the following:
//    node cli.js options-required
//    node cli.js options-required --cheese blue
const optionsRequired = (cli) => {
    cli.addCommand({
        description: "Demonstrate options required",
        execute: ({ logger, options }) => {
            logger.log(`Cheese: ${options.cheese}`);
        },
        group: "options",
        name: "options-required",
        options: [
            {
                description: "Add the specified type of cheese",
                name: "cheese",
                required: true,
                type: String,
            },
        ],
    });
};

export default optionsRequired;
