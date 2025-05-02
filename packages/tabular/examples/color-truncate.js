import colorize from "@visulima/colorize";

import { createTable } from "../dist/index.mjs";

console.log("\n");
// Create a table with colored text and truncation
const table = createTable({ columnWidths: 40 });

// Add rows with colored text that will be truncated
table.addRow(["Position", "Colored Text", { content: "Truncation" }]);

// Test end truncation
table.addRow([
    "End",
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        maxWidth: 20,
        truncate: {
            position: "end",
            space: true,
        },
    },
    "Colors preserved",
]);

// Test middle truncation
table.addRow([
    "Middle",
    {
        content: colorize.yellow("Beginning") + colorize.blue(" colored ") + colorize.green("ending"),
        maxWidth: 15,
        truncate: {
            position: "middle",
            space: true,
        },
    },
    "Colors preserved",
]);

// Test start truncation
table.addRow([
    "Start",
    {
        content: colorize.red("Start") + colorize.blue(" of colored ") + colorize.green("text here"),
        maxWidth: 15,
        truncate: {
            position: "start",
            space: true,
        },
    },
    "Colors preserved",
]);

console.log(table.toString());

// Create a table with colored text and truncation
const table2 = createTable({ columnWidths: 25 });

// Test end truncation
table2.addRow([
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        truncate: {
            position: "end",
            space: true,
        },
    },
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        maxWidth: 20,
        truncate: {
            position: "end",
            space: true,
        },
    },
]);

console.log(table2.toString());
