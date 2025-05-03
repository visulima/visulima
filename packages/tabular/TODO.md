columnWidths + maxWidth on cell do not have the correct width

```
const table2 = createTable({ columnWidths: 25 });

// Test end truncation
table2.addRow([
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        truncate: {
            position: "end",
            space: true,
        },
    },
    {
        content: colorize.red("This is some ") + colorize.blue("colored text") + colorize.green(" that will be truncated"),
        maxWidth: 20,
        truncate: {
            position: "end",
            space: true,
        },
    },
]);

console.log(table2.toString());
```

The "Very Long Content Here" has one space to much

```
const table = createTable();
table
    .addRow([{ colSpan: 3, content: "Wide Header" }])
    .addRow(["Short", { content: "Very Long Content Here", colSpan: 2 }])
    .addRow(["A", "B", "C"])
    .addRow(["Long Content", "Short", "Medium Text"]);

console.log(table.toString());
console.log();
```

Current output
┌────────────────────────────────────────┐
│ Wide Header │
├──────────────┬─────────────────────────┤
│ Short │ Very Long Content Here │
├──────────────┼─────────┬───────────────┤
│ A │ B │ C │
├──────────────┼─────────┼───────────────┤
│ Long Content │ Short │ Medium Text │
└──────────────┴─────────┴───────────────┘
