// Try the following:
//    node cli.js error-critical
const errorCritical = (cli) => {
    cli.addCommand({
        description: "Demonstrate critical level error logging",
        execute: () => {
            const error = new Error("Critical system failure");

            error.severity = "critical";
            error.affectedSystems = ["database", "cache"];

            throw error;
        },
        group: "errors",
        name: "error-critical",
    });
};

export default errorCritical;
