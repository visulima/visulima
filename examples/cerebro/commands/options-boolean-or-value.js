// Try the following:
//    node cli.js options-boolean-or-value
//    node cli.js options-boolean-or-value --cheese
//    node cli.js options-boolean-or-value --cheese mozzarella
const optionsBooleanOrValue = (cli) => {
    cli.addCommand({
        name: "options-boolean-or-value",
        description: "Demonstrate options required",
        group: "options",
        options: [
            {
                name: "cheese",
                description: "Add cheese with optional type",
                type: Boolean,
            },
        ],
        execute: ({ logger, options }) => {
            logger.log(options);

            if (typeof options.cheese === "undefined") {
                logger.log("no cheese");
            } else if (options.cheese === true) {
                logger.log("add cheese");
            } else {
                logger.log(`add cheese type ${options.cheese}`);
            }
        },
    });
};

export default optionsBooleanOrValue;
