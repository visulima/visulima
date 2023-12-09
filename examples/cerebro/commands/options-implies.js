// Try the following:
//    node options-implies.js
//    node options-implies.js --quiet
//    node options-implies.js --log-level=warning --quiet
//    node options-implies.js --cheese=cheddar
//    node options-implies.js --no-cheese
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
