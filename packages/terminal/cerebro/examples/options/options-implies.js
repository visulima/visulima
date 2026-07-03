// Try the following:
//    node cli.js options-implies
//    node cli.js options-implies --quiet
//    node cli.js options-implies --log-level=warning --quiet
//    node cli.js options-implies --cheese=cheddar
//    node cli.js options-implies --no-cheese
const optionsImplies = (cli) => {
    cli.addCommand({
        description: "Demonstrate options implies",
        execute: ({ logger, options }) => {
            logger.log(options);
        },
        group: "options",
        name: "options-implies",
        options: [
            {
                description: "Silence output",
                implies: {
                    logLevel: "off",
                },
                name: "quiet",
                type: Boolean,
            },
            {
                defaultValue: "info",
                description: "Set the logging level",
                name: "log-level",
                type: String,
            },
            {
                alias: "c",
                defaultValue: "mozzarella",
                description: "Add the specified type of cheese",
                implies: {
                    dairy: true,
                },
                name: "cheese",
                type: String,
            },
            {
                defaultValue: false,
                description: "You do not want any cheese",
                implies: {
                    dairy: false,
                },
                name: "no-cheese",
                type: Boolean,
            },
            {
                description: "May contain dairy",
                name: "dairy",
                type: Boolean,
            },
        ],
    });
};

export default optionsImplies;
