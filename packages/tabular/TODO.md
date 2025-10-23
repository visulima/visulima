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
