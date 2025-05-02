import colorize, { bgHex, blue, green, red } from "@visulima/colorize";

import { createTable } from "../dist/index.mjs";
import { DOTS_BORDER } from "../dist/style.mjs";

console.log("Test 1: Basic Table with Spanning Cells");
const table = createTable();
table
    .addRow([{ colSpan: 3, content: "Wide Header" }])
    .addRow(["Short", { colSpan: 2, content: "Very Long Content Here" }])
    .addRow(["A", "B", "C"])
    .addRow(["Long Content", "Short", "Medium Text"]);

console.log(table.toString());
console.log();

console.log("Test 2: Optimized Space Usage");
const table2 = createTable();
table2
    .addRow(["ID", "Name", "Status"])
    .addRow(["1", { colSpan: 2, content: "John Smith" }])
    .addRow(["2", "Jane", "Active"])
    .addRow([{ colSpan: 3, content: "Important Note" }]);

console.log(table2.toString());
console.log();

console.log("Test 3: Mixed Content Lengths");
const table3 = createTable();
table3
    .addRow(["Col 1", { colSpan: 2, content: "Spanning Header" }])
    .addRow(["Short", "Medium Length", "Longer Content"])
    .addRow([{ colSpan: 1, content: "Wide Content in First Column" }, "B", "C"]);

console.log(table3.toString());

const table4 = createTable({
    backgroundColor: red,
    gap: 4,
    paddingLeft: 0,
    paddingRight: 0,
});

// First row spans both columns with exact width
table4.addRow([
    {
        colSpan: 2,
        content: "hello there",
        hAlign: "left",
    },
]);

// Second row has two cells with exact width
table4.addRow([
    { content: "hi", hAlign: "left" },
    { content: "hi", hAlign: "left" },
]);

console.log(table4.toString());

// ┌─────────────────────┐
// │ hello there         │
// ├───────────┬─────────┤
// │ hi        │     hi  │
// └───────────┴─────────┘

const table5 = createTable();

table5.addRow(["A1", { colSpan: 2, content: "CS=2" }]);
table5.addRow([
    { content: "RS=2", rowSpan: 2 },
    { colSpan: 2, content: "CS=2, RS=21", rowSpan: 2 },
]);

console.log(table5.toString());

const table6 = createTable({ columnWidths: 5 });
table6.addRow([{ colSpan: 2, content: "This is a wide cell spanning two columns" }]);

console.log(table6.toString());

const table7 = createTable({ columnWidths: 25 });

// Test end truncation
table7.addRow([
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        truncate: {
            position: "end",
            space: true,
        },
    },
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        maxWidth: 10,
        truncate: {
            position: "end",
            space: true,
        },
    },
]);

console.log(table7.toString());

console.log("Test 8: Middle Alignment with Row Span");
const table8 = createTable();
table8
    .addRow([
        { colSpan: 2, content: "hello" },
        { colSpan: 2, content: "sup\nman\nhey", rowSpan: 2 },
        { content: "hi\nyo", rowSpan: 3 },
    ])
    .addRow([{ colSpan: 2, content: "howdy" }])
    .addRow(["o", "k", "", ""]);

console.log(table8.toString());

// Expected output for table8:
// ┌───────┬─────┬────┐
// │ hello │ sup │ hi │
// ├───────┤ man │ yo │
// │ howdy │ hey │    │
// ├───┬───┼──┬──┤    │
// │ o │ k │  │  │    │
// └───┴───┴──┴──┴────┘

const table9 = createTable({ rowHeights: [1, 2] });
table9.addRow(["first\nsecond"]).addRow(["another\nmultiline\ntext"]);

console.log(table9.toString());

const table10 = createTable();

table10.addRow([{ content: "A1", rowSpan: 3, vAlign: "middle" }, "B1", "C1"]);
table10.addRow(["B2", "C2"]);
table10.addRow(["B3", "C3"]);

console.log(table10.toString());

// ┌────┬────┬────┐
// │    │ B1 │ C1 │
// │    ├────┼────┤
// │ A1 │ B2 │ C2 │
// │    ├────┼────┤
// │    │ B3 │ C3 │
// └────┴────┴────┘

console.log("Test 11: Middle Alignment with Row Span");
const table11 = createTable();

table11.addRow([{ content: "A1", rowSpan: 2, vAlign: "middle" }, "B1", "C1"]);
table11.addRow(["B2", "C2"]);
table11.addRow(["A2", "B3", "C3"]);

console.log(table11.toString());

// Expected output for table11 with vAlign: middle, rowSpan: 2:
// ┌────┬────┬────┐
// │    │ B1 │ C1 │
// │ A1 ├────┼────┤
// │    │ B2 │ C2 │
// ├────┼────┼────┤
// │ A2 │ B3 │ C3 │
// └────┴────┴────┘

console.log("Test 12: Middle Alignment with Row Span");
const table12 = createTable();

table12.addRow([{ content: "A1\nA1.2", rowSpan: 2, vAlign: "middle" }, "B1", "C1"]);
table12.addRow(["B2", "C2"]);
table12.addRow(["A2", "B3", "C3"]);

console.log(table12.toString());

// Expected output for table11 with vAlign: middle, rowSpan: 2:
// ┌────┬────┬────┐
// │    │ B1 │ C1 │
// │ A1 ├────┼────┤
// │ A2 │ B2 │ C2 │
// ├────┼────┼────┤
// │ A2 │ B3 │ C3 │
// └────┴────┴────┘

const table13 = createTable({
    columnWidths: 9,
    wordWrap: true,
});

table13.addRow([red("Hello how are you?"), blue("I am fine thanks!")]);

console.log(table13.toString());

const table14 = createTable({ rowHeights: [2, 1] });
table14.addRow([{ content: "spanning\ncell\nwith\nmore\nlines", rowSpan: 2 }, "regular"]).addRow(["second"]);

console.log(table14.toString());

// Expected output for table14:
// ┌──────────┬─────────┐
// │ spanning │ regular │
// │ cell     │         │
// │ with     ├─────────┤
// │ more     │ second  │
// └──────────┴─────────┘

const table15 = createTable({
    style: {
        backgroundColor: bgHex("#3d239d"),
    },
});
table15
    .addRow(["hello", { content: "greetings", rowSpan: 2 }, { content: "greetings", href: "https://example.com", rowSpan: 2, vAlign: "bottom" }])
    .addRow(["howdy"]);
console.log(table15.toString());

// ┌───────┬───────────┬───────────┐
// │ hello │ greetings │           │
// ├───────┤           │           │
// │ howdy │           │ greetings │
// └───────┴───────────┴───────────┘

const table16 = createTable({
    style: {
        backgroundColor: bgHex("#3d239d"),
        borderColor: red,
        foregroundColor: blue,
    },
});
table16.addRow([{ content: "spanning\ncell\nwith\nmore\nlines", rowSpan: 2 }, "regular"]).addRow(["second"]);

console.log(table16.toString());

// Expected output for table16:
// ┌──────────┬─────────┐
// │ spanning │ regular │
// │ cell     │         │
// │ with     ├─────────┤
// │ more     │ second  │
// │ lines    │         │
// └──────────┴─────────┘

const table17 = createTable({
    style: {
        border: DOTS_BORDER,
    },
});

table17.setHeaders([
    { content: "Top\nAlign", vAlign: "top" },
    { content: "Middle\nAlign", vAlign: "middle" },
    { content: "Bottom\nAlign", vAlign: "bottom" },
]);
table17.addRows([
    { content: "Short", vAlign: "top" },
    { content: "Medium\nText", vAlign: "middle" },
    { content: "Long\nText\nHere", vAlign: "bottom" },
]);

console.log(table17.toString());

// Expected output for table17:
// ┌┈┈┈┈┈┈┈┬┈┈┈┈┈┈┈┈┬┈┈┈┈┈┈┈┈┐
// ┊ Top   ┊ Middle ┊ Bottom ┊
// ┊ Align ┊ Align  ┊ Align  ┊
// ├┈┈┈┈┈┈┈┼┈┈┈┈┈┈┈┈┼┈┈┈┈┈┈┈┈┤
// ┊ Short ┊        ┊ Long   ┊
// ┊       ┊ Medium ┊ Text   ┊
// ┊       ┊ Text   ┊ Here   ┊
// └┈┈┈┈┈┈┈┴┈┈┈┈┈┈┈┈┴┈┈┈┈┈┈┈┈┘

const emojiTable = createTable({
    wordWrap: true,
});

emojiTable.setHeaders(["Table"]);
emojiTable.addRow(["🥇 Some Text", 24]);
emojiTable.addRow(["🥈 Some more text", 22]);
emojiTable.addRow(["🥉 I am a reallylong name", 19]);
emojiTable.addRow(["I have a super duperlongname", 18]);

console.log(emojiTable.toString());

const tableLink = createTable();
const url = "https://example.com";
const linkText = "Example";

tableLink.addRow([{ content: linkText, href: url }]);

console.log(tableLink.toString());

const table18 = createTable();
table18
    .addRow([{ colSpan: 3, content: "Wide Header" }])
    .addRow(["Short", { colSpan: 2, content: "Very Long Content Here" }])
    .addRow(["A", "B", "C"])
    .addRow(["Long Content", "Short", "Medium Text"]);

console.log(table18.toString());

const table19 = createTable({
    style: {
        borderColor: red,
    },
});

table19.addRow(["Cell 1"]);
table19.addRow(["Cell 2"]);
table19.addRow([{ colSpan: 2, content: "Cell 3", foregroundColor: blue }]); // Content blue

console.log(table19.toString());

/* Expected Output (Conceptual):
   ┌────────┬────────┐  <-- Border should be red
   │ Cell 1 │ Cell 2 │  <-- Border red, content default
   ├────────┼────────┤  <-- Border red
   │ Cell 3          │  <-- Border red, content blue
   └────────┴────────┘  <-- Border red
*/

const table20 = createTable({
    style: {
        backgroundColor: bgHex("#3d239d"),
        borderColor: red,
        foregroundColor: blue,
    },
});

table20.addRow(["Cell 1"]);
table20.addRow(["Cell 2"]);
table20.addRow([{ colSpan: 2, content: "Cell 3", foregroundColor: green }]); // Content blue

console.log(table20.toString());
