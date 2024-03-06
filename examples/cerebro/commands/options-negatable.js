// Try the following:
//    node cli.js options-negatable
//    node cli.js options-negatable --sauce
//    node cli.js options-negatable --cheese=blue
//    node cli.js options-negatable --no-sauce --no-cheese
const optionsNegatable = (cli) => {
    cli.addCommand({
        name: "options-negatable",
        description: "You can specify a boolean option long name with a leading `no-` to make it true by default and able to be negated.",
        group: "options",
        options: [
            {
                name: "no-sauce",
                description: "Remove sauce",
                type: Boolean,
                defaultValue: true,
            },
            {
                name: "cheese",
                description: "Add the specified type of cheese",
                type: String,
                defaultValue: "mozzarella",
            },
            {
                name: "no-cheese",
                description: "plain with no cheese",
                type: Boolean,
                defaultValue: false,
            },
            {
                name: "ignore-no-sauce",
                description: "Ignore the sauce and no-sauce option",
                type: Boolean,
                defaultValue: false,
            },
        ],
        execute: ({ logger, options }) => {
            const sauceStr = options.ignoreNoSauce ? "ignore" : options.sauce ? "sauce" : "no sauce";
            const cheeseStr = options.cheese === false ? "no cheese" : `${options.cheese} cheese`;

            logger.log(`You ordered a pizza with ${sauceStr} and ${cheeseStr}`);
        },
    });
};

export default optionsNegatable;
