import { blue, green, magenta,red, yellow } from "@visulima/colorize";

import { createTable } from "../dist";

console.log("\nColorized border example:");
const table = createTable({
    style: {
        border: {
            bodyJoin: blue("│"),
            bodyLeft: blue("│"),
            bodyRight: blue("│"),
            bottomBody: red("─"),

            bottomJoin: red("┴"),
            bottomLeft: red("└"),
            bottomRight: red("┘"),
            headerJoin: yellow("─"),

            joinBody: magenta("─"),
            joinJoin: magenta("┼"),
            joinLeft: magenta("├"),

            joinRight: magenta("┤"),
            topBody: green("─"),
            topJoin: green("┬"),
            topLeft: green("┌"),

            topRight: green("┐"),
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
