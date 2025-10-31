// Try the following:
//    node cli.js options-implies
//    node cli.js options-implies --quiet
//    node cli.js options-implies --log-level=warning --quiet
//    node cli.js options-implies --cheese=cheddar
//    node cli.js options-implies --no-cheese
const optionsImplies = (cli) => {
    cli.addCommand({
        name: "options-implies",
        description: "Demonstrate options implies",
        group: "options",
        options: [
            {
                name: "quiet",
                description: "Silence output",
                type: Boolean,
                implies: {
                    logLevel: "off",
                },
            },
            {
                name: "log-level",
                description: "Set the logging level",
                type: String,
                defaultValue: "info",
            },
            {
                name: "cheese",
                alias: "c",
                description: "Add the specified type of cheese",
                type: String,
                defaultValue: "mozzarella",
                implies: {
                    dairy: true,
                },
            },
            {
                name: "no-cheese",
                description: "You do not want any cheese",
                type: Boolean,
                defaultValue: false,
                implies: {
                    dairy: false,
                },
            },
            {
                name: "dairy",
                description: "May contain dairy",
                type: Boolean,
            },
        ],
        execute: ({ logger, options }) => {
            logger.log(options);
        },
    });
};

export default optionsImplies;
