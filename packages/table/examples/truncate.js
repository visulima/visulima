import { createTable } from "../dist";

console.log("\n");
// Test different truncation positions
const test1 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test1.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "end" } }]);
console.log("End truncation:");
console.log(test1.toString());

const test2 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test2.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "start" } }]);
console.log("\nStart truncation:");
console.log(test2.toString());

const test3 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test3.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "middle" } }]);
console.log("\nMiddle truncation:");
console.log(test3.toString());

// Test space and truncation character options
const test4 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test4.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "end", space: true } }]);
console.log("\nWith space:");
console.log(test4.toString());

const test5 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test5.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "end", truncationCharacter: "+" } }]);
console.log("\nCustom truncation character:");
console.log(test5.toString());

const test6 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test6.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "end", space: true, truncationCharacter: ">" } }]);
console.log("\nSpace and custom character:");
console.log(test6.toString());

// Test preferTruncationOnSpace option
const test7 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test7.addRow(["", "   ", { content: "This is a long string", truncateOptions: { position: "end", preferTruncationOnSpace: true } }]);
console.log("\nPrefer truncation on space:");
console.log(test7.toString());

// Test all options together
const test8 = createTable({ maxWidth: 5, style: { paddingLeft: 0, paddingRight: 0 } });
test8.addRow([
    "",
    "   ",
    { content: "This is a long string", truncateOptions: { position: "end", preferTruncationOnSpace: true, space: true, truncationCharacter: ">" } },
]);
console.log("\nAll options together:");
console.log(test8.toString());

// Test with longer maxWidth to better show preferTruncationOnSpace
const test9 = createTable({ maxWidth: 15, style: { paddingLeft: 0, paddingRight: 0 } });
test9.addRow(["", "   ", { content: "Hello world this is a test", truncateOptions: { position: "end", preferTruncationOnSpace: true } }]);
console.log("\nLonger maxWidth with preferTruncationOnSpace:");
console.log(test9.toString());

const test10 = createTable({ maxWidth: 15, style: { paddingLeft: 0, paddingRight: 0 } });
test10.addRow(["", "   ", { content: "Hello world this is a test", truncateOptions: { position: "end", preferTruncationOnSpace: false } }]);
console.log("\nLonger maxWidth without preferTruncationOnSpace:");
console.log(test10.toString());

const CJKtable = createTable({ maxWidth: 6 });
CJKtable.addRows(
    ["foobar", { content: "English test", maxWidth: 9 }, "baz"],
    ["foobar", { content: "中文测试", maxWidth: 9 }, "baz"],
    ["foobar", { content: "日本語テスト", maxWidth: 9 }, "baz"],
    ["foobar", { content: "한국어테스트", maxWidth: 9 }, "baz"],
    ["Test", "こんにちは", "🌟🌟🌟🌟🌟"],
);
console.log("\nTable with CJK characters:");
console.log(CJKtable.toString());
