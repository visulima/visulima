// Try the following:
//    node cli.js options-boolean-or-value
//    node cli.js options-boolean-or-value --cheese
//    node cli.js options-boolean-or-value --cheese mozzarella
const optionsBooleanOrValue = (cli) => {
    cli.addCommand({
        description: "Demonstrate options required",
        execute: ({ logger, options }) => {
            logger.log(options);

            if (options.cheese === undefined) {
                logger.log("no cheese");
            } else if (options.cheese === true) {
                logger.log("add cheese");
            } else {
                logger.log(`add cheese type ${options.cheese}`);
            }
        },
        group: "options",
        name: "options-boolean-or-value",
        options: [
            {
                description: "Add cheese with optional type",
                name: "cheese",
                type: Boolean,
            },
        ],
    });
};

export default optionsBooleanOrValue;
