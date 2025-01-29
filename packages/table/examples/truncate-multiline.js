import { Table } from "../dist/index.mjs";

// Example 4: Table with truncated content and multi-line text
const table = new Table({
    truncate: true,
    maxWidth: 120, // Maximum width for cell content before truncation
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

console.log("Example 4: Table with truncated content and multi-line text");
console.log(table.toString());
