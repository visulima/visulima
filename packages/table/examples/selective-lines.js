import { createTable } from "../dist/index.mjs";

const table = createTable({
    drawHorizontalLine: (lineIndex, rowCount) => {
        // Draw only top, header, and bottom lines
        return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount;
    },
});

table
    .setHeaders(["ID", "Status", "Description"])
    .addRow(["1", "✅ Active", "Service is running"])
    .addRow(["2", "⚠️ Warning", "High memory usage"])
    .addRow(["3", "❌ Error", "Connection failed"]);

console.log(table.toString());
