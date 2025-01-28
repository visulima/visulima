import { createTable } from "../dist/index.mjs";

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

// Example 2: Heavy border style
console.log("Heavy border style:");
const heavyTable = createTable({
    border: {
        topBody: "═",
        topJoin: "╤",
        topLeft: "╔",
        topRight: "╗",
        bottomBody: "═",
        bottomJoin: "╧",
        bottomLeft: "╚",
        bottomRight: "╝",
        bodyLeft: "║",
        bodyRight: "║",
        bodyJoin: "│",
        joinBody: "═",
        joinLeft: "╟",
        joinRight: "╢",
        joinJoin: "┼",
    },
})
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

console.log(heavyTable.toString());
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
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow(["Strength", "18", "+4"])
    .addRow(["Dexterity", "14", "+2"])
    .addRow(["Constitution", "16", "+3"])
    .addRow(["Intelligence", "14", "+2"])
    .addRow(["Wisdom", "15", "+2"])
    .addRow(["Charisma", "16", "+3"]);

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
