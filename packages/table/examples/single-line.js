import { createTable } from "../dist";

console.log("");

const table = createTable({
    drawHorizontalLine: (lineIndex, rowCount) => lineIndex === 0 || lineIndex === rowCount,
});

table
    .setHeaders(["ID", "Status", "Description"])
    .addRow(["1", "✅ Active", "Service is running"])
    .addRow(["2", "⚠️ Warning", "High memory usage"])
    .addRow(["3", "❌ Error", "Connection failed"]);

console.log(table.toString());
