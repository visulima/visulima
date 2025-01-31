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


console.log("Empty cells and null values 2:");
const emptyTable3 = createTable()
    .setHeaders(["", null, undefined])
    .addRow(["", { content: "" }, { content: null }])
    .addRow(["", { content: undefined }, { content: "" }]);

console.log(emptyTable3.toString());

console.log("\nEmpty cells and null values (no headers) 2:");
const emptyTable4 = createTable()
    .addRow(["", { content: "" }, { content: null }])
    .addRow(["", { content: undefined }, { content: "" }]);

console.log(emptyTable4.toString());
