import { createTable } from "../dist/index.mjs";
import { HEAVY_BORDER, ROUNDED_BORDER } from "../dist/style.mjs";

// Example 1: Right-aligned numbers with heavy border
console.log("Example 1: Right-aligned numbers with heavy border");
const salesTable = createTable({
    border: HEAVY_BORDER,
    align: "right",
    padding: 2,
})
    .setHeaders([
        { content: "Product", hAlign: "left" },
        "Units Sold",
        "Revenue",
        { content: "Growth", hAlign: "center" }
    ])
    .addRow(["Widgets", "1,230", "$12,300", "+15%"])
    .addRow(["Gadgets", "2,480", "$24,800", "+22%"])
    .addRow(["Gizmos", "3,790", "$37,900", "+18%"])
    .addRow(["Total", "7,500", "$75,000", "+19%"]);

console.log(salesTable.toString());
console.log("\n");

// Example 2: Mixed alignment with rounded borders
console.log("Example 2: Mixed alignment with rounded borders");
const employeeTable = createTable({
    border: ROUNDED_BORDER,
    padding: 2,
})
    .setHeaders([
        { content: "Employee ID", hAlign: "center" },
        { content: "Name", hAlign: "left" },
        { content: "Department", hAlign: "left" },
        { content: "Salary", hAlign: "right" }
    ])
    .addRow(["EMP001", "John Smith", "Engineering", "$85,000"])
    .addRow(["EMP002", "Sarah Johnson", "Marketing", "$72,000"])
    .addRow(["EMP003", "Michael Brown", "Finance", "$78,000"])
    .addRow(["EMP004", "Emily Davis", "HR", "$65,000"]);

console.log(employeeTable.toString());
console.log("\n");

// Example 3: Centered content with custom border
console.log("Example 3: Centered content with custom border");
const customTable = createTable({
    border: {
        topBody: "═",
        topJoin: "╦",
        topLeft: "╔",
        topRight: "╗",
        bottomBody: "═",
        bottomJoin: "╩",
        bottomLeft: "╚",
        bottomRight: "╝",
        bodyLeft: "║",
        bodyRight: "║",
        bodyJoin: "║",
        joinBody: "═",
        joinLeft: "╠",
        joinRight: "╣",
        joinJoin: "╬",
    },
    align: "center",
    padding: 3,
})
    .setHeaders(["Category", "Q1", "Q2", "Q3", "Q4"])
    .addRow(["Sales", "$10.2M", "$12.4M", "$14.8M", "$18.2M"])
    .addRow(["Expenses", "$8.1M", "$9.3M", "$11.2M", "$13.9M"])
    .addRow(["Profit", "$2.1M", "$3.1M", "$3.6M", "$4.3M"]);

console.log(customTable.toString());
console.log("\n");

// Example 4: Wide table with truncation
console.log("Example 4: Wide table with truncation");
const wideTable = createTable({
    truncate: true,
    maxWidth: 30,
    padding: 1,
})
    .setHeaders([
        { content: "Project", hAlign: "left" },
        { content: "Description", hAlign: "left" },
        { content: "Status", hAlign: "center" },
        { content: "Priority", hAlign: "center" }
    ])
    .addRow([
        "Website Redesign",
        "Complete overhaul of company website with modern design and improved UX",
        "In Progress",
        "High"
    ])
    .addRow([
        "Mobile App",
        "Native mobile application for both iOS and Android platforms",
        "Planning",
        "Medium"
    ])
    .addRow([
        "DB Migration",
        "Migrate legacy database to new cloud infrastructure with zero downtime",
        "Pending",
        "Critical"
    ]);

console.log(wideTable.toString());
