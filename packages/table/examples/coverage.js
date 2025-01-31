import { Table } from "../dist/index.mjs";
import { red, green, yellow, blue, magenta, cyan, gray } from "@visulima/colorize";

// Example 1: Basic table with colors and alignment
console.log("Example 1: Basic table with colors and alignment");
const table = new Table({
    padding: 2,
});

table
    .setHeaders([
        { content: "Name", hAlign: "center" },
        { content: "Status", hAlign: "center" },
        { content: "Coverage", hAlign: "center" },
    ])
    .addRow([
        { content: "Core Module", hAlign: "left" },
        { content: green("✓ Passed"), hAlign: "center" },
        { content: "98%", hAlign: "right" },
    ])
    .addRow([
        { content: "Utils", hAlign: "left" },
        { content: yellow("⚠ Warning"), hAlign: "center" },
        { content: "85%", hAlign: "right" },
    ])
    .addRow([
        { content: "UI Components", hAlign: "left" },
        { content: red("✗ Failed"), hAlign: "center" },
        { content: "62%", hAlign: "right" },
    ]);

console.log(table.toString());
console.log();

// Example 2: Table with row and column spans
const table2 = new Table({
    padding: 2,
});

table2
    .setHeaders([
        { content: "Component", hAlign: "center" },
        { content: "Tests", hAlign: "center", colSpan: 2 },
        { content: "Coverage", hAlign: "center" },
    ])
    .addRow([
        { content: "Frontend", rowSpan: 2, hAlign: "center" },
        { content: "Unit", hAlign: "left" },
        { content: green("156/156"), hAlign: "right" },
        { content: "100%", hAlign: "right" },
    ])
    .addRow([
        null, // rowSpan from above
        { content: "Integration", hAlign: "left" },
        { content: yellow("23/25"), hAlign: "right" },
        { content: "92%", hAlign: "right" },
    ])
    .addRow([
        { content: "Backend", rowSpan: 2, hAlign: "center" },
        { content: "Unit", hAlign: "left" },
        { content: green("312/312"), hAlign: "right" },
        { content: "100%", hAlign: "right" },
    ])
    .addRow([
        null, // rowSpan from above
        { content: "Integration", hAlign: "left" },
        { content: red("45/60"), hAlign: "right" },
        { content: "75%", hAlign: "right" },
    ]);

console.log("Example 2: Table with row and column spans");
console.log(table2.toString());
console.log();

// Example 3: Table with Unicode characters and emojis
const table3 = new Table({
    padding: 2,
    style: {
        border: {
            bodyJoin: "│",
            bodyLeft: "│",
            bodyRight: "│",
            bottomBody: "─",
            bottomJoin: "┴",
            bottomLeft: "└",
            bottomRight: "┘",
            joinBody: "─",
            joinJoin: "┼",
            joinLeft: "├",
            joinRight: "┤",
            topBody: "─",
            topJoin: "┬",
            topLeft: "┌",
            topRight: "┐"
        }
    }
});

table3
    .setHeaders([
        { content: "📊 Metrics", hAlign: "left" },
        { content: "📈 Progress", hAlign: "center" },
        { content: "🎯 Target", hAlign: "right" },
    ])
    .addRow([
        { content: "代码覆盖率", hAlign: "left" },
        { content: blue("▓▓▓▓▓▓▓▓░░ 80%"), hAlign: "center" },
        { content: "90%", hAlign: "right" },
    ])
    .addRow([
        { content: "性能测试", hAlign: "left" },
        { content: green("▓▓▓▓▓▓▓▓▓░ 95%"), hAlign: "center" },
        { content: "85%", hAlign: "right" },
    ])
    .addRow([
        { content: "安全扫描", hAlign: "left" },
        { content: red("▓▓▓▓░░░░░░ 40%"), hAlign: "center" },
        { content: "100%", hAlign: "right" },
    ]);

console.log("Example 3: Table with Unicode characters and emojis");
console.log(table3.toString());
console.log();

// Example 4: Table with truncated content and multi-line text
console.log("Example 4: Table with truncated content and multi-line text");
const table4 = new Table({
    padding: 2,
});

table4
    .setHeaders([
        { content: "Feature", hAlign: "center" },
        { content: "Description", hAlign: "center" },
        { content: "Status", hAlign: "center" },
    ])
    .addRow([
        { content: magenta("Authentication"), hAlign: "left" },
        { content: cyan("This is a very long description that will be automatically truncated to fit within the cell width while preserving ANSI colors and maintaining proper alignment."), hAlign: "left", maxWidth: 50 },
        { content: green("Active"), hAlign: "center" },
    ])
    .addRow([
        { content: yellow("Authorization"), hAlign: "left" },
        { content: yellow("Role-based access control\nwith multi-tenant support"), hAlign: "left", maxWidth: 50 },
        { content: yellow("Pending"), hAlign: "center" },
    ])
    .addRow([
        { content: red("Monitoring"), hAlign: "left" },
        { content: gray("System health checks\nand performance metrics"), hAlign: "left", maxWidth: 50 },
        { content: red("Inactive"), hAlign: "center" },
    ]);

console.log(table4.toString());

// Example 5: Coverage Report
console.log("Coverage Report:");
const coverageTable = new Table({
    padding: 2,
    style: {
        border: {
            bodyJoin: "│",
            bodyLeft: "│",
            bodyRight: "│",
            bottomBody: "─",
            bottomJoin: "┴",
            bottomLeft: "└",
            bottomRight: "┘",
            joinBody: "─",
            joinJoin: "┼",
            joinLeft: "├",
            joinRight: "┤",
            topBody: "─",
            topJoin: "┬",
            topLeft: "┌",
            topRight: "┐"
        }
    }
});

coverageTable
    .setHeaders([
        { content: "Component", hAlign: "left" },
        { content: "Tests", hAlign: "left" },
        { content: "Tests", hAlign: "right" },
        { content: "Coverage", hAlign: "right" },
    ])
    .addRow([
        { content: "Frontend", hAlign: "left" },
        { content: "Unit", hAlign: "left" },
        { content: "156/156", hAlign: "right" },
        { content: "100%", hAlign: "right" },
    ])
    .addRow([
        { content: "", hAlign: "left" },
        { content: "Integration", hAlign: "left" },
        { content: "23/25", hAlign: "right" },
        { content: "92%", hAlign: "right" },
    ])
    .addRow([
        { content: "Backend", hAlign: "left" },
        { content: "Unit", hAlign: "left" },
        { content: "312/312", hAlign: "right" },
        { content: "100%", hAlign: "right" },
    ])
    .addRow([
        { content: "", hAlign: "left" },
        { content: "Integration", hAlign: "left" },
        { content: "45/60", hAlign: "right" },
        { content: "75%", hAlign: "right" },
    ]);

console.log(coverageTable.toString());
