export default {
    name: "main:colors",
    description: "Output colors",
    dashed: true,
    options: [
        {
            name: "color2",
            description: "Color to output",
            type: String,
        },
        {
            name: "color3",
            description: "Color to output",
            type: String,
        },
    ],
    argument: {
        name: "color",
        description: "Color to output",
        required: true,
        type: String,
    },
    examples: [
        ["1. A concise example. ", "$ example -t 100 lib/*.js"],
        ["2. A long example. ", "$ example --timeout 100 --src lib/*.js"],
        [
            "3. This example will scan space for unknown things. Take cure when scanning space, it could take some time. ",
            "$ example --src galaxy1.facts galaxy1.facts galaxy2.facts galaxy3.facts galaxy4.facts galaxy5.facts",
        ],
    ],
    execute: ({ logger, print, runtime, options, argument, argv }) => {
        logger.info("Colors command");
        logger.info(JSON.stringify(options));
        logger.info(JSON.stringify(argument));
        logger.info(JSON.stringify(argv));

        logger.info(runtime.getPackageVersion());

        print.table(
            ["First Name", "Last Name", "Age"],
            [
                ["Jamon", "Holmgren", 35],
                ["Gant", "Laborde", 36],
                ["Steve", "Kellock", 43],
                ["Gary", "Busey", 73],
            ],
            {
                fullWidth: true,
                format: "markdown",
            },
        );

        print.instructions(
            {
                content: ["This is a test", "This is another test"],
                heading: "Instructions",
            },
            {
                fullWidth: true,
            },
        );
    },
};
