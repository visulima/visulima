import { createTable } from "../dist/index.mjs";

console.log("\nTable with header (default):\n");

const tableWithHeader = createTable();
tableWithHeader
    .setHeaders(["Name", "Age", "City"])
    .addRow(["John", "25", "New York"])
    .addRow(["Jane", "30", "London"])
    .addRow(["Bob", "35", "Paris"]);

console.log(tableWithHeader.toString());

console.log("\nTable without header:\n");

const tableWithoutHeader = createTable({
    showHeader: false,
});

tableWithoutHeader
    .setHeaders(["Name", "Age", "City"])
    .addRow(["John", "25", "New York"])
    .addRow(["Jane", "30", "London"])
    .addRow(["Bob", "35", "Paris"]);

console.log(tableWithoutHeader.toString());
