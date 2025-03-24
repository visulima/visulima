import { createTable } from "../dist";
import { ROUNDED_BORDER } from "../dist/style.mjs";

// Helper function to simulate streaming data
const simulateDataStream = async (onData, interval = 1000, maxItems = 5) => {
    let count = 0;
    const statuses = ["Running", "Completed", "Failed", "Pending"];
    const processes = ["Data Import", "Processing", "Validation", "Export", "Cleanup"];

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            count++;
            const data = {
                id: count,
                process: processes[Math.floor(Math.random() * processes.length)],
                progress: `${Math.floor(Math.random() * 100)}%`,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                timestamp: new Date().toLocaleTimeString(),
            };

            onData(data);

            if (count >= maxItems) {
                clearInterval(timer);
                resolve();
            }
        }, interval);
    });
};

// Create a table with headers
const table = createTable({
    border: ROUNDED_BORDER,
});

// Set up headers
table.setHeaders([
    { content: "ID", hAlign: "center" },
    { content: "Process", hAlign: "left" },
    { content: "Status", hAlign: "center" },
    { content: "Progress", hAlign: "right" },
    { content: "Timestamp", hAlign: "center" },
]);

console.log("\nStreaming Data Example:\n");

// Clear the console and move cursor up
const clearAndMoveCursor = (rows) => {
    process.stdout.write(`\u001B[${rows}A`);
    process.stdout.write("\u001B[0J");
};

// Keep track of rows for cursor movement
let rowCount = 0;

// Function to update the display
const updateDisplay = () => {
    if (rowCount > 0) {
        clearAndMoveCursor(rowCount);
    }
    const output = table.toString();
    console.log(output);
    rowCount = output.split("\n").length;
};

// Initial display
updateDisplay();

// Process streaming data
await simulateDataStream(
    (data) => {
        // Add color based on status
        const status = (() => {
            switch (data.status) {
                case "Running": {
                    return `\u001B[33m${data.status}\u001B[0m`;
                } // Yellow
                case "Completed": {
                    return `\u001B[32m${data.status}\u001B[0m`;
                } // Green
                case "Failed": {
                    return `\u001B[31m${data.status}\u001B[0m`;
                } // Red
                default: {
                    return `\u001B[90m${data.status}\u001B[0m`;
                } // Gray
            }
        })();

        // Add the new row
        table.addRow([
            { content: data.id, hAlign: "center" },
            { content: data.process, hAlign: "left" },
            { content: status, hAlign: "center" },
            { content: data.progress, hAlign: "right" },
            { content: data.timestamp, hAlign: "center" },
        ]);

        // Update the display
        updateDisplay();
    },
    1000, // Update every second
    10, // Show 10 items
);

// Add a small delay before final message
await new Promise((resolve) => setTimeout(resolve, 500));
console.log("\nStreaming completed!");
