import { createTable } from "../dist/index.mjs";

console.log("Empty cells and null values:");
const emptyTable = createTable()
    .setHeaders(["", null, undefined])
    .addRow(["", { content: "" }, { content: null }])
    .addRow([" ", { content: undefined }, { content: "" }]);

console.log(emptyTable.toString());

console.log("\nEmpty cells and null values (no headers):");
const emptyTable2 = createTable()
    .addRow(["", { content: "" }, { content: null }])
    .addRow([" ", { content: undefined }, { content: "" }]);

console.log(emptyTable2.toString());
