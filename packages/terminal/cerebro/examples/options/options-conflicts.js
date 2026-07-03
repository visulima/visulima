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
        description: "With a single string, which is the camel-case name of the conflicting option.",
        execute: ({ logger, options }) => {
            if (options.cash) {
                logger.log("Paying by cash");
            } else if (options.creditCard) {
                logger.log("Paying by credit card");
            } else {
                logger.log("Payment method unknown");
            }
        },
        group: "options",
        name: "options-single-conflicts",
        options: [
            {
                conflicts: "creditCard",
                name: "cash",
                type: Boolean,
            },
            {
                name: "credit-card",
                type: Boolean,
            },
        ],
    });

    cli.addCommand({
        description: "With an array of option names. A negated option is not separate from the positive option for conflicts (they have same option name).",
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
        group: "options",
        name: "options-multi-conflicts",
        options: [
            {
                conflicts: ["autumn", "colour"],
                description: "use a mixture of summer colors",
                name: "summer",
                type: String,
            },
            {
                conflicts: ["summer", "colour"],
                description: "use a mixture of autumn colors",
                name: "autumn",
                type: String,
            },
            {
                description: "use a single solid colour",
                name: "colour",
                type: String,
            },
            {
                description: "leave surface natural",
                name: "no-colour",
                type: Boolean,
            },
        ],
    });

    cli.addCommand({
        description: "The default value for an option does not cause a conflict.",
        execute: ({ logger, options }) => {
            logger.log("Source command");
            logger.log(`Interactive mode: ${options.interactive}`);
            logger.log(`Port: ${options.port}`);
        },
        group: "options",
        name: "options-default-conflicts",
        options: [
            {
                default: false,
                description: "Interactive mode",
                name: "interactive",
                type: Boolean,
            },
            {
                default: 3000,
                description: "Port",
                name: "port",
                type: Number,
            },
        ],
    });
};

export default optionsConflicts;
