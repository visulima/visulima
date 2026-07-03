// packages/cerebro/examples/options/options-common.js

// Try the following:
//    node cli.js options-common -p
//    node cli.js options-common -d -s -p vegetarian
//    node cli.js options-common --pizza-type=cheese

/**
 * Sets up a command with common option types (string, boolean) and default values
 * @param {import("@visulima/cerebro").Cerebro} cli - The Cerebro CLI instance to add the command to
 * @returns {void}
 */
const optionsCommon = (cli) => {
    cli.addCommand({
        execute: ({ logger, options }) => {
            logger.log(`Pizza type: ${options.pizzaType}`);
            logger.log(`Drink: ${options.drink}`);
            logger.log(`Sauce: ${options.sauce}`);
            logger.log(`Vegetarian: ${options.vegetarian}`);
        },
        group: "options",
        name: "options-common",
        options: [
            {
                alias: "p",
                defaultValue: "pepperoni",
                description: "Add the specified type of pizza",
                name: "pizza-type",
                type: String,
            },
            {
                alias: "d",
                defaultValue: "soda",
                description: "Add the specified drink",
                name: "drink",
                type: String,
            },
            {
                alias: "s",
                defaultValue: "tomato",
                description: "Add the specified sauce",
                name: "sauce",
                type: String,
            },
            {
                alias: "v",
                defaultValue: false,
                description: "Add the specified vegetarian",
                name: "vegetarian",
                type: Boolean,
            },
        ],
    });
};

export default optionsCommon;
