// Try the following:
//    node cli.js options-negatable
//    node cli.js options-negatable --sauce
//    node cli.js options-negatable --cheese=blue
//    node cli.js options-negatable --no-sauce --no-cheese
const optionsNegatable = (cli) => {
    cli.addCommand({
        description: "You can specify a boolean option long name with a leading `no-` to make it true by default and able to be negated.",
        execute: ({ logger, options }) => {
            const sauceString = options.ignoreNoSauce ? "ignore" : options.sauce ? "sauce" : "no sauce";
            const cheeseString = options.cheese === false ? "no cheese" : `${options.cheese} cheese`;

            logger.log(`You ordered a pizza with ${sauceString} and ${cheeseString}`);
        },
        group: "options",
        name: "options-negatable",
        options: [
            {
                defaultValue: true,
                description: "Remove sauce",
                name: "no-sauce",
                type: Boolean,
            },
            {
                defaultValue: "mozzarella",
                description: "Add the specified type of cheese",
                name: "cheese",
                type: String,
            },
            {
                defaultValue: false,
                description: "plain with no cheese",
                name: "no-cheese",
                type: Boolean,
            },
            {
                defaultValue: false,
                description: "Ignore the sauce and no-sauce option",
                name: "ignore-no-sauce",
                type: Boolean,
            },
        ],
    });
};

export default optionsNegatable;
