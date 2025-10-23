import { createTable } from "../dist/index.js";

console.log("=== Balanced Widths Examples ===\n");

// Example 1: Basic balanced widths
console.log("1. Basic balanced widths (should distribute evenly):");
const table1 = createTable({
    balancedWidths: true,
    maxWidth: 50,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

table1.addRow([
    "Short",
    "Medium length text",
    "Very long content that should be constrained"
]);

console.log(table1.toString());
console.log();

// Example 2: Different content lengths
console.log("2. Different content lengths:");
const table2 = createTable({
    balancedWidths: true,
    maxWidth: 60,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

table2.addRow([
    "A",           // Very short
    "Medium",      // Medium length
    "Very long content here that will be truncated"  // Long content
]);

console.log(table2.toString());
console.log();

// Example 3: Comparison with regular table (no balancedWidths)
console.log("3. Regular table (no balancedWidths) for comparison:");
const table3 = createTable({
    maxWidth: 60,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

table3.addRow([
    "A",
    "Medium",
    "Very long content here that will be truncated"
]);

console.log(table3.toString());
console.log();

// Example 4: With headers
console.log("4. With headers:");
const table4 = createTable({
    balancedWidths: true,
    maxWidth: 50,
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

table4.setHeaders(["ID", "Name", "Description"]);
table4.addRow(["1", "John", "A short description"]);
table4.addRow(["2", "Jane", "A much longer description that should demonstrate the balancing"]);

console.log(table4.toString());
console.log();

console.log("=== Analysis ===");
console.log("With balancedWidths: true, columns have roughly equal widths (balanced).");
console.log("With balancedWidths: false, columns size based on content (unbalanced).");
console.log("Both modes work correctly now!");
