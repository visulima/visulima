import { createTable } from "../dist/index.mjs";
import { DOUBLE_BORDER } from "../dist/style.mjs";

const OSC = "\u001B]";
const BEL = "\u0007";
const SEP = ";";
const url = "https://example.com";
const text = "This is a link to example.com";

const link = [OSC, "8", SEP, SEP, url, BEL, text, OSC, "8", SEP, SEP, BEL].join("");

// Example 1: Default style
console.log("Default style:");
const defaultTable = createTable()
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

console.log(defaultTable.toString());
console.log("\n");

// Example 2: Double border style
console.log("Double border style:");
const doubleTable = createTable({
    border: DOUBLE_BORDER,
})
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

console.log(doubleTable.toString());
console.log("\n");

// Example 3: Rounded style with center alignment
console.log("Rounded style with center alignment:");
const roundedTable = createTable({
    align: "center",
    border: {
        topBody: "─",
        topJoin: "┬",
        topLeft: "╭",
        topRight: "╮",
        bottomBody: "─",
        bottomJoin: "┴",
        bottomLeft: "╰",
        bottomRight: "╯",
        bodyLeft: "│",
        bodyRight: "│",
        bodyJoin: "│",
        joinBody: "─",
        joinLeft: "├",
        joinRight: "┤",
        joinJoin: "┼",
    },
})
    .setHeaders(["Character", "Ability Score", "Modifier", "link"])
    .addRow(["Strength", "18", "+4", ""])
    .addRow(["Dexterity", "14", "+2", ""])
    .addRow(["Constitution", "16", "+3", ""])
    .addRow(["Intelligence", "14", "+2", ""])
    .addRow(["Wisdom", "15", "+2", link])
    .addRow(["Charisma", "16", "+3", link]);

console.log(roundedTable.toString());
console.log("\n");

// Example 4: Minimal style with right alignment for numbers
console.log("Minimal style with right alignment for numbers:");
const minimalTable = createTable({
    border: {
        topBody: "─",
        topJoin: "┬",
        topLeft: "┌",
        topRight: "┐",
        bottomBody: "─",
        bottomJoin: "┴",
        bottomLeft: "└",
        bottomRight: "┘",
        bodyLeft: "│",
        bodyRight: "│",
        bodyJoin: "│",
        joinBody: "─",
        joinLeft: "├",
        joinRight: "┤",
        joinJoin: "┼",
    },
    padding: 2,
})
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

console.log(minimalTable.toString());

// Example 5: No Borders
console.log("No Borders:");
const noBordersTable = createTable({
    align: "center",
    border: {},
})
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

console.log(noBordersTable.toString());

// Example 5: Empty cells and null values
console.log("Empty cells and null values:");
const emptyTable = createTable()
    .setHeaders(["", null, undefined])
    .addRow(["", { content: "" }, { content: null }])
    .addRow([" ", { content: undefined }, { content: "" }]);

console.log(emptyTable.toString());

const emptyTable2 = createTable()
    .addRow(["", { content: "" }, { content: null }])
    .addRow([" ", { content: undefined }, { content: "" }]);

console.log(emptyTable2.toString());

// Example with headers set but not shown
console.log("\nHeaders set but not shown:");
const tableWithHiddenHeaders = createTable({ showHeader: false });
tableWithHiddenHeaders.setHeaders(["Column 1", "Column 2", "Column 3"]);
tableWithHiddenHeaders.addRow(["Value 1", "Value 2", "Value 3"]);
tableWithHiddenHeaders.addRow(["Value 4", "Value 5", "Value 6"]);

console.log(tableWithHiddenHeaders.toString());
