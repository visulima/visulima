import { createTable } from "../dist/index.mjs";
import { DOUBLE_BORDER, ROUNDED_BORDER, DEFAULT_BORDER } from "../dist/style.mjs";

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
    style: {
        border: DOUBLE_BORDER,
    },
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
    style: {
        border: ROUNDED_BORDER,
    },
})
    .setHeaders(["Character", "Ability Score", "Modifier", "link"])
    .addRow([{ content: "Strength", hAlign: "center" }, { content: "18", hAlign: "center" }, { content: "+4", hAlign: "center" }, { content: "" }])
    .addRow([{ content: "Dexterity", hAlign: "center" }, { content: "14", hAlign: "center" }, { content: "+2", hAlign: "center" }, { content: "" }])
    .addRow([{ content: "Constitution", hAlign: "center" }, { content: "16", hAlign: "center" }, { content: "+3", hAlign: "center" }, { content: "" }])
    .addRow([{ content: "Intelligence", hAlign: "center" }, { content: "14", hAlign: "center" }, { content: "+2", hAlign: "center" }, { content: "" }])
    .addRow([{ content: "Wisdom", hAlign: "center" }, { content: "15", hAlign: "center" }, { content: "+2", hAlign: "center" }, { content: link }])
    .addRow([{ content: "Charisma", hAlign: "center" }, { content: "16", hAlign: "center" }, { content: "+3", hAlign: "center" }, { content: link }]);

console.log(roundedTable.toString());
console.log("\n");

// Example 4: Minimal style with right alignment for numbers
console.log("Minimal style with right alignment for numbers:");
const minimalTable = createTable({
    style: {
        border: DEFAULT_BORDER,
    },
    padding: 2,
})
    .setHeaders(["Character", "Ability Score", "Modifier"])
    .addRow([{ content: "Strength" }, { content: "18", hAlign: "right" }, { content: "+4", hAlign: "right" }])
    .addRow([{ content: "Dexterity" }, { content: "14", hAlign: "right" }, { content: "+2", hAlign: "right" }])
    .addRow([{ content: "Constitution" }, { content: "16", hAlign: "right" }, { content: "+3", hAlign: "right" }])
    .addRow([{ content: "Intelligence" }, { content: "14", hAlign: "right" }, { content: "+2", hAlign: "right" }])
    .addRow([{ content: "Wisdom" }, { content: "15", hAlign: "right" }, { content: "+2", hAlign: "right" }])
    .addRow([{ content: "Charisma" }, { content: "16", hAlign: "right" }, { content: "+3", hAlign: "right" }]);

console.log(minimalTable.toString());

// Example 5: No Borders
console.log("No Borders:");
const noBordersTable = createTable({
    style: {
        border: {},
    },
})
    .setHeaders([
        { content: "Character", hAlign: "center" },
        { content: "Ability Score", hAlign: "center" },
        { content: "Modifier", hAlign: "center" },
    ])
    .addRow([
        { content: "Strength", hAlign: "center" },
        { content: "18", hAlign: "center" },
        { content: "+4", hAlign: "center" },
    ])
    .addRow([
        { content: "Dexterity", hAlign: "center" },
        { content: "14", hAlign: "center" },
        { content: "+2", hAlign: "center" },
    ])
    .addRow([
        { content: "Constitution", hAlign: "center" },
        { content: "16", hAlign: "center" },
        { content: "+3", hAlign: "center" },
    ])
    .addRow([
        { content: "Intelligence", hAlign: "center" },
        { content: "14", hAlign: "center" },
        { content: "+2", hAlign: "center" },
    ])
    .addRow([
        { content: "Wisdom", hAlign: "center" },
        { content: "15", hAlign: "center" },
        { content: "+2", hAlign: "center" },
    ])
    .addRow([
        { content: "Charisma", hAlign: "center" },
        { content: "16", hAlign: "center" },
        { content: "+3", hAlign: "center" },
    ]);

console.log(noBordersTable.toString());

// Example 6: Empty cells and null values
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
const tableWithHiddenHeaders = createTable({
    showHeader: false,
    style: {
        border: DEFAULT_BORDER,
    },
});
tableWithHiddenHeaders.setHeaders(["Column 1", "Column 2", "Column 3"]);
tableWithHiddenHeaders.addRow(["Value 1", "Value 2", "Value 3"]);
tableWithHiddenHeaders.addRow(["Value 4", "Value 5", "Value 6"]);

console.log(tableWithHiddenHeaders.toString());

// Example with different padding for left and right
console.log("\nTable with different left and right padding:");
const table = createTable({
    style: {
        paddingLeft: 2,
        paddingRight: 1,
    },
});

table.setHeaders(["Name", "Age", "City"]);
table.addRow(["John Doe", "30", "New York"]);
table.addRow(["Jane Smith", "25", "Los Angeles"]);
table.addRow(["Bob Johnson", "35", "Chicago"]);

console.log(table.toString());

// Example with minimal padding
console.log("\nTable with no padding:");
const minimalPaddingTable = createTable({
    style: {
        paddingLeft: 0,
        paddingRight: 0,
    },
});

minimalPaddingTable.setHeaders(["ID", "Status", "Value"]);
minimalPaddingTable.addRow(["1", "Active", "100"]);
minimalPaddingTable.addRow(["2", "Inactive", "200"]);
minimalPaddingTable.addRow(["3", "Pending", "300"]);

console.log(minimalPaddingTable.toString());

// Example with extra right padding for alignment
console.log("\nTable with alignment and custom padding:");
const alignedTable = createTable({
    style: {
        paddingLeft: 5,
        paddingRight: 3,
    },
});

alignedTable.setHeaders([
    { content: "Product", hAlign: "left" },
    { content: "Price", hAlign: "right" },
    { content: "Stock", hAlign: "center" },
]);

alignedTable.addRow([
    { content: "Widget", hAlign: "left" },
    { content: "$10.00", hAlign: "right" },
    { content: "50", hAlign: "center" },
]);

alignedTable.addRow([
    { content: "Gadget", hAlign: "left" },
    { content: "$15.99", hAlign: "right" },
    { content: "25", hAlign: "center" },
]);

console.log(alignedTable.toString());

// Example with only headers
console.log("\nTable with only headers:");
const onlyHeaderTable = createTable();

onlyHeaderTable.setHeaders(["Test", "1\n2\n3"]);

console.log(onlyHeaderTable.toString());

// Example with multiple column spans
console.log("\nTable with multiple column spans:");
const colspanTable = createTable();

colspanTable.setHeaders([{ content: "Span All", colSpan: 3 }]);

colspanTable.addRow([{ content: "Span Two", colSpan: 2 }, "C"]);

colspanTable.addRow(["A", { content: "Span Two", colSpan: 2 }]);

colspanTable.addRow(["A", "B", "C"]);

colspanTable.addRow([{ content: "Span All", colSpan: 3 }]);

console.log(colspanTable.toString());

console.log("\nTable with newlines:");
const newLinesTable = createTable();
newLinesTable.addRow(["something\nwith\nnewlines"]);
console.log(newLinesTable.toString());

const table3 = createTable();
table3.addRow([{ colSpan: 2, content: "Spanning Two Columns" }, "Normal"]).addRow(["A", "B", "C"]);
console.log(table3.toString());

// Example with truncated cells
console.log("\nTable with truncated cells:");
const truncatedTable = createTable();
truncatedTable.setHeaders([
    { content: "Short Header", maxWidth: 10 },
    { content: "This is a very long header that will be truncated", maxWidth: 15 },
    { content: "Normal" },
]);
truncatedTable.addRow([{ content: "Short", maxWidth: 10 }, { content: "This is a very long cell that will be truncated", maxWidth: 15 }, "Normal"]);
console.log(truncatedTable.toString());

// Example with truncated colored cells
console.log("\nTable with truncated colored cells:");
const coloredTable = createTable();
coloredTable.setHeaders([
    { content: "\u001B[31mRed Header That Will Be Truncated\u001B[0m", maxWidth: 15 },
    { content: "\u001B[32mGreen Header That Will Be Truncated\u001B[0m", maxWidth: 15 },
    { content: "Normal" },
]);
coloredTable.addRow([
    { content: "\u001B[31mRed Cell That Will Be Truncated\u001B[0m", maxWidth: 15 },
    { content: "\u001B[32mGreen Cell That Will Be Truncated\u001B[0m", maxWidth: 15 },
    "Normal",
]);
console.log(coloredTable.toString());

console.log("\nTable with word wrap:");
const wordWrapTable = createTable({
    wordWrap: true,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

wordWrapTable.setHeaders(["Description", "Status", "Notes"]);
wordWrapTable.addRow([
    { content: "This is a very long description that should be automatically wrapped to fit within the cell width", wordWrap: true },
    { content: "Active and pending review from the team", wordWrap: true },
    { content: "Multiple notes need to be added here for context", wordWrap: true },
]);
wordWrapTable.addRow([
    { content: "A shorter description", wordWrap: true },
    { content: "Completed", wordWrap: true },
    { content: "This is a very long note that will be wrapped automatically to demonstrate the word wrap feature", wordWrap: true },
]);

console.log(wordWrapTable.toString());

console.log("\nTable with mixed wrap and truncate:");
const mixedTable = createTable({
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

mixedTable.setHeaders(["Description", "Status", "Notes"]);
mixedTable.addRow([
    { content: "This is a very long description that should be wrapped", wordWrap: true },
    { content: "This status will be truncated because it's too long", maxWidth: 10 },
    { content: "These notes will be wrapped to fit", wordWrap: true },
]);

console.log(mixedTable.toString());

console.log("\nTable with word-wrapped colored text:");
const coloredWordWrapTable = createTable({
    wordWrap: true,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

coloredWordWrapTable.setHeaders(["Red Text", "Green Text", "Mixed Colors"]);
coloredWordWrapTable.addRow([
    { content: "\u001b[31mThis is a very long line of red text that should be wrapped properly across multiple lines while maintaining the color\u001b[0m" },
    { content: "\u001b[32mThis is a very long line of green text that should be wrapped properly across multiple lines while maintaining the color\u001b[0m" },
    {
        content:
            "\u001b[31mRed text\u001b[0m and \u001b[32mgreen text\u001b[0m mixed together in a very long line that should wrap properly while maintaining both colors",
    },
]);

console.log(coloredWordWrapTable.toString());

console.log("\nTable with Emoji and word wrap:");
const emojiTable = createTable({
    wordWrap: true,
    maxWidth: 15,
});

emojiTable.setHeaders(["Table"]);
emojiTable.addRow(["🥇 Some Text", 24]);
emojiTable.addRow(["🥈 Some more text", 22]);
emojiTable.addRow(["🥉 I am a reallylong name", 19]);
emojiTable.addRow(["I have a super duperlongname", 18]);

console.log(emojiTable.toString());

console.log("\nTable with CJK characters:");
const CJKtable = createTable({ maxWidth: 6 });

CJKtable.addRows([
    ["foobar", { content: "English test", maxWidth: 9 }, "baz"],
    ["foobar", { content: "中文测试", maxWidth: 9 }, "baz"],
    ["foobar", { content: "日本語テスト", maxWidth: 9 }, "baz"],
    ["foobar", { content: "한국어테스트", maxWidth: 9 }, "baz"],
    ["Test", "こんにちは", "🌟🌟🌟🌟🌟"]
]);

console.log(CJKtable.toString());
