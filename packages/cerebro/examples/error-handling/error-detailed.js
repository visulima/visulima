// Try the following:
//    node cli.js error-detailed
const errorDetailed = (cli) => {
    cli.addCommand({
        description: "Demonstrate detailed error handling with stack trace and additional properties",
        execute: () => {
            const error = new Error("Detailed error with additional context");

            error.code = "ERR_DEMO";
            error.statusCode = 500;
            error.context = { action: "test", userId: 123 };

            throw error;
        },
        group: "errors",
        name: "error-detailed",
    });
};

export default errorDetailed;
