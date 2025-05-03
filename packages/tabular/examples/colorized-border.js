import { blue, green, magenta, red, yellow } from "@visulima/colorize";

import { createTable } from "../dist";

console.log("\nColorized border example:");
const table = createTable({
    style: {
        border: {
            bodyJoin: { char: blue("│"), width: 1 },
            bodyLeft: { char: blue("│"), width: 1 },
            bodyRight: { char: blue("│"), width: 1 },
            bottomBody: { char: red("─"), width: 1 },

            bottomJoin: { char: red("┴"), width: 1 },
            bottomLeft: { char: red("└"), width: 1 },
            bottomRight: { char: red("┘"), width: 1 },
            headerJoin: { char: yellow("─"), width: 1 },

            joinBody: { char: magenta("─"), width: 1 },
            joinJoin: { char: magenta("┼"), width: 1 },
            joinLeft: { char: magenta("├"), width: 1 },

            joinRight: { char: magenta("┤"), width: 1 },
            topBody: { char: green("─"), width: 1 },
            topJoin: { char: green("┬"), width: 1 },
            topLeft: { char: green("┌"), width: 1 },

            topRight: { char: green("┐"), width: 1 },
        },
    },
});

// Example data: Server status dashboard
table
    .setHeaders([
        { content: "Server", hAlign: "center" },
        { content: "Load", hAlign: "center" },
        { content: "Uptime", hAlign: "right" },
        { content: "Status", hAlign: "center" },
    ])
    .addRow(["API Server", green("28%"), "24d 12h", green("● Online")])
    .addRow(["Database", yellow("78%"), "15d 6h", yellow("● Warning")])
    .addRow(["Cache", red("92%"), "7d 3h", red("● Critical")]);

console.log(table.toString());
