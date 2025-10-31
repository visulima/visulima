// Try the following:
//    node cli.js error-simple
const errorSimple = (cli) => {
    cli.addCommand({
        description: "Demonstrate simple error handling (default behavior)",
        execute: () => {
            throw new Error("This is a simple error message");
        },
        group: "errors",
        name: "error-simple",
    });
};

export default errorSimple;
