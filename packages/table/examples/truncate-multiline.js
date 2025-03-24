import { createTable } from "../dist";

console.log("\nExample 4: Table with truncated content and multi-line text\n");

// Example 4: Table with truncated content and multi-line text
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
