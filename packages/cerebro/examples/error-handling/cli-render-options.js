import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

// Custom renderError options demonstration
const cli = new Cerebro("cerebro-errors");

cli.addPlugin(
    errorHandlerPlugin({
        detailed: true,
        renderOptions: {
            linesAbove: 4,
            linesBelow: 4,
            hideErrorCodeView: false,
            hideErrorTitle: false,
            hideMessage: false,
            framesMaxLimit: 5, // Limit stack trace frames
        },
    }),
);

cli.addCommand({
    description: "Demonstrate custom renderError options",
    execute: () => {
        const error = new Error("Error with custom render options");

        error.code = "ERR_RENDER_DEMO";
        error.severity = "high";
        error.affectedSystems = ["database", "cache"];

        throw error;
    },
    name: "error-render-options",
});

await cli.run({ argv: ["error-render-options"] });

