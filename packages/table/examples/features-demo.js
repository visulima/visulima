import { createTable } from "../dist/index.mjs";

// Basic table creation
console.log("Basic Table:");
const basicTable = createTable();
basicTable.addRow(["Name", "Age", "City"]);
basicTable.addRow(["John Doe", "30", "New York"]);
basicTable.addRow(["Jane Smith", "25", "Los Angeles"]);
console.log(basicTable.toString());

// Styled table with alignment and borders
console.log("\nStyled Table:");
const styledTable = createTable({
    style: {
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
            joinJoin: "┼"
        },
        paddingLeft: 1,
        paddingRight: 1
    }
});

styledTable.addRow([
    { content: "Product", style: { align: "center" } },
    { content: "Price", style: { align: "right" } },
    { content: "Stock", style: { align: "center" } }
]);
styledTable.addRow(["Coffee Maker", "$99.99", "15"]);
styledTable.addRow(["Toaster", "$49.99", "25"]);
console.log(styledTable.toString());

// Table with truncation and word wrap
console.log("\nTruncation and Word Wrap:");
const wrapTable = createTable({ maxWidth: 40 });
wrapTable.addRow([
    "Short",
    {
        content: "This is a very long content that will be wrapped",
        wordWrap: true
    },
    {
        content: "This will be truncated",
        truncate: {
            position: "end",
            preferTruncationOnSpace: true
        }
    }
]);
console.log(wrapTable.toString());

// Table with spanning and custom styling
console.log("\nSpanning and Custom Styling:");
const spanTable = createTable();
spanTable.addRow([{ content: "Quarterly Report", colSpan: 3, style: { align: "center" } }]);
spanTable.addRow(["Q1", "Q2", "Q3"]);
spanTable.addRow(["$10,000", "$15,000", "$20,000"]);
console.log(spanTable.toString());

// Table with multi-line content and vertical alignment
console.log("\nMulti-line and Vertical Alignment:");
const multilineTable = createTable();
multilineTable.addRow([
    {
        content: "Title\nSubtitle",
        style: { paddingLeft: 1, paddingRight: 1 },
        vAlign: "top"
    },
    {
        content: "Description\nwith\nmultiple lines",
        style: { paddingLeft: 1, paddingRight: 1 },
        vAlign: "middle"
    },
    {
        content: "Footer\nNote",
        style: { paddingLeft: 1, paddingRight: 1 },
        vAlign: "bottom"
    }
]);
console.log(multilineTable.toString());
