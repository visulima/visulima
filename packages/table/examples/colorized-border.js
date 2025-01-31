import { createTable } from "../dist/index.mjs";
import { red, green, blue, yellow, magenta } from "@visulima/colorize";

console.log("\nColorized border example:");
const table = createTable({
    style: {
        border: {
            topBody: green("─"),
            topJoin: green("┬"),
            topLeft: green("┌"),
            topRight: green("┐"),

            bottomBody: red("─"),
            bottomJoin: red("┴"),
            bottomLeft: red("└"),
            bottomRight: red("┘"),

            bodyLeft: blue("│"),
            bodyRight: blue("│"),
            bodyJoin: blue("│"),

            joinBody: magenta("─"),
            joinLeft: magenta("├"),
            joinRight: magenta("┤"),
            joinJoin: magenta("┼"),

            headerJoin: yellow("─"),
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
