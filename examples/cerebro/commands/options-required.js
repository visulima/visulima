// Try the following:
//    node options-required.js
//    node options-required.js --cheese blue
const optionsRequired = (cli) => {
    cli.addCommand({
        name: "options-required",
        description: "Demonstrate options required",
        group: "options",
        options: [
            {
                name: "cheese",
                description: "Add the specified type of cheese",
                type: String,
                required: true,
            },
        ],
        execute: ({ logger, options }) => {
            logger.log(`Cheese: ${options.cheese}`);
        },
    });
};

export default optionsRequired;
