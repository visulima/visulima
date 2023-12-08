export default {
    name: "colors",
    description: "Output colors",
    execute: ({ logger }) => {
        logger.info("Colors command");
    },
    argument: {
        name: "test",
        description: "test",
        type: String,
    },
    options: [
        {
            name: "color",
            description: "Color",
            type: String,
            default: "red",
        },
    ],
};
