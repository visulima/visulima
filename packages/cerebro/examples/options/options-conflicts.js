// Try the following:
//    node cli.js options-single-conflicts --cash --credit-card
//
//    node cli.js source
//    node cli.js source --interactive
//    node cli.js source --port 8080 --interactive
//    PORT=8080 node cli.js source --interactive
//
//    node cli.js options-multi-conflicts --colour=red --summer
//    node cli.js options-multi-conflicts --no-colour --autumn

const optionsConflicts = (cli) => {
    cli.addCommand({
        name: "options-single-conflicts",
        description: "With a single string, which is the camel-case name of the conflicting option.",
        group: "options",
        options: [
            {
                name: "cash",
                conflicts: "creditCard",
                type: Boolean,
            },
            {
                name: "credit-card",
                type: Boolean,
            },
        ],
        execute: ({ logger, options }) => {
            if (options.cash) {
                logger.log("Paying by cash");
            } else if (options.creditCard) {
                logger.log("Paying by credit card");
            } else {
                logger.log("Payment method unknown");
            }
        },
    });

    cli.addCommand({
        name: "options-multi-conflicts",
        description: "With an array of option names. A negated option is not separate from the positive option for conflicts (they have same option name).",
        group: "options",
        options: [
            {
                name: "summer",
                description: "use a mixture of summer colors",
                conflicts: ["autumn", "colour"],
                type: String,
            },
            {
                name: "autumn",
                description: "use a mixture of autumn colors",
                conflicts: ["summer", "colour"],
                type: String,
            },
            {
                name: "colour",
                description: "use a single solid colour",
                type: String,
            },
            {
                name: "no-colour",
                description: "leave surface natural",
                type: Boolean,
            },
        ],
        execute: ({ logger, options }) => {
            let colour = "not specified";
            if (options.colour === false) {
                colour = "natural";
            } else if (options.colour) {
                colour = options.colour;
            } else if (options.summer) {
                colour = "summer";
            } else if (options.autumn) {
                colour = "autumn";
            }

            logger.log(`Painting colour is ${colour}`);
        },
    });

    cli.addCommand({
        name: "options-default-conflicts",
        description: "The default value for an option does not cause a conflict.",
        group: "options",
        options: [
            {
                name: "interactive",
                description: "Interactive mode",
                type: Boolean,
                default: false,
            },
            {
                name: "port",
                description: "Port",
                type: Number,
                default: 3000,
            },
        ],
        execute: ({ logger, options }) => {
            logger.log("Source command");
            logger.log(`Interactive mode: ${options.interactive}`);
            logger.log(`Port: ${options.port}`);
        },
    });
};

export default optionsConflicts;
