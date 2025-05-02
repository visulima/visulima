import { createTable } from "../dist/index.mjs";

console.log("\n");
// Test different truncation positions
const test1 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test1.addRow(["", "   ", { content: "This is a long string", truncate: { position: "end" } }]);
console.log("End truncation:");
console.log(test1.toString());

const test2 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test2.addRow(["", "   ", { content: "This is a long string", truncate: { position: "start" } }]);
console.log("\nStart truncation:");
console.log(test2.toString());

const test3 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test3.addRow(["", "   ", { content: "This is a long string", truncate: { position: "middle" } }]);
console.log("\nMiddle truncation:");
console.log(test3.toString());

// Test space and truncation character options
const test4 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test4.addRow(["", "   ", { content: "This is a long string", truncate: { position: "end", space: true } }]);
console.log("\nWith space:");
console.log(test4.toString());

const test5 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test5.addRow(["", "   ", { content: "This is a long string", truncate: { position: "end", truncationCharacter: "+" } }]);
console.log("\nCustom truncation character:");
console.log(test5.toString());

const test6 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test6.addRow(["", "   ", { content: "This is a long string", truncate: { position: "end", space: true, truncationCharacter: ">" } }]);
console.log("\nSpace and custom character:");
console.log(test6.toString());

// Test preferTruncationOnSpace option
const test7 = createTable({ columnWidths: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test7.addRow(["", "   ", { content: "This is a long string", truncate: { position: "end", preferTruncationOnSpace: true } }]);
console.log("\nPrefer truncation on space:");
console.log(test7.toString());

// Test all options together
const test8 = createTable({
    columnWidths: 5,
    style: { paddingLeft: 0, paddingRight: 0 },
    truncate: { position: "end", preferTruncationOnSpace: true, space: true, truncationCharacter: ">" },
});
test8.addRow([
    "",
    "   ",
    { content: "This is a long string", truncate: { position: "end", preferTruncationOnSpace: true, space: true, truncationCharacter: ">" } },
]);
console.log("\nAll options together:");
console.log(test8.toString());

// Test with longer maxWidth to better show preferTruncationOnSpace
const test9 = createTable({ columnWidths: 15, style: { paddingLeft: 0, paddingRight: 0 }, truncate: { position: "end", preferTruncationOnSpace: true } });
test9.addRow(["", "   ", { content: "Hello world this is a test", truncate: { position: "end", preferTruncationOnSpace: true } }]);
console.log("\nLonger maxWidth with preferTruncationOnSpace:");
console.log(test9.toString());

const test10 = createTable({ columnWidths: 15, style: { paddingLeft: 0, paddingRight: 0 }, truncate: true });
test10.addRow(["", "   ", { content: "Hello world this is a test", truncate: { position: "end", preferTruncationOnSpace: false } }]);
console.log("\nLonger maxWidth without preferTruncationOnSpace:");
console.log(test10.toString());

const CJKtable = createTable({ columnWidths: 8, truncate: true });
CJKtable.addRows(
    ["foobar", { content: "English test", maxWidth: 9 }, "baz"],
    ["foobar", { content: "中文测试", maxWidth: 9 }, "baz"],
    ["foobar", { content: "日本語テスト", maxWidth: 9 }, "baz"],
    ["foobar", { content: "한국어테스트", maxWidth: 9 }, "baz"],
    ["Test", "こんにちは", "🌟🌟🌟🌟🌟"],
);
console.log("\nTable with CJK characters:");
console.log(CJKtable.toString());

console.log("\nTable with truncated content and multi-line text\n");
// Table with truncated content and multi-line text
const table = createTable({
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
    truncate: "...",
});

table
    .setHeaders([
        { content: "Feature", hAlign: "center" },
        { content: "Description", hAlign: "center" },
        { content: "Status", hAlign: "center" },
    ])
    .addRow([
        { content: "Authentication", hAlign: "left" },
        {
            content:
                "This is a very long description that will be automatically truncated to fit within the cell width while preserving ANSI colors and maintaining proper alignment.",
            hAlign: "left",
            maxWidth: 50,
        },
        { content: "Active", hAlign: "center" },
    ])
    .addRow([
        { content: "Authorization", hAlign: "left" },
        {
            content: "Role-based access control\nwith multi-tenant support",
            hAlign: "left",
        },
        { content: "Pending", hAlign: "center" },
    ])
    .addRow([
        { content: "Monitoring", hAlign: "left" },
        {
            content: "System health checks\nand performance metrics",
            hAlign: "left",
        },
        { content: "Inactive", hAlign: "center" },
    ]);

console.log(table.toString());
