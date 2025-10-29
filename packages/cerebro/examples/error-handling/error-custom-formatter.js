// Try the following:
//    node cli.js error-custom-formatter
const errorCustomFormatter = (cli) => {
    cli.addCommand({
        description: "Demonstrate custom error formatting",
        execute: () => {
            const error = new Error("Error with custom formatting");

            error.errorId = "ERR-2024-001";
            error.timestamp = new Date().toISOString();

            throw error;
        },
        group: "errors",
        name: "error-custom-formatter",
    });
};

export default errorCustomFormatter;
