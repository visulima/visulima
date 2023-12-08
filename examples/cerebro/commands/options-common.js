// Try the following:
//    node options-common.js -p
//    node options-common.js -d -s -p vegetarian
//    node options-common.js --pizza-type=cheese
const optionsCommon = (cli) => {
    cli.addCommand({
        name: "options-common",
        group: "options",
        options: [
            {
                name: "pizza-type",
                description: "Add the specified type of pizza",
                type: String,
                defaultValue: "pepperoni",
                alias: "p",
            },
            {
                name: "drink",
                description: "Add the specified drink",
                type: String,
                defaultValue: "soda",
                alias: "d",
            },
            {
                name: "sauce",
                description: "Add the specified sauce",
                type: String,
                defaultValue: "tomato",
                alias: "s",
            },
            {
                name: "vegetarian",
                description: "Add the specified vegetarian",
                type: Boolean,
                defaultValue: false,
                alias: "v",
            },
        ],
        execute: ({ logger, options }) => {
            logger.log(`Pizza type: ${options.pizzaType}`);
            logger.log(`Drink: ${options.drink}`);
            logger.log(`Sauce: ${options.sauce}`);
            logger.log(`Vegetarian: ${options.vegetarian}`);
        },
    });
};

export default optionsCommon;
