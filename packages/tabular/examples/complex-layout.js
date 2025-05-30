import { createTable } from "../dist";

/**
 * This example demonstrates a complex table layout with:
 * - Column and row spanning
 * - Vertical and horizontal alignment
 * - Border styling
 *
 * The output looks like this:
 * ┌────────────────────────────────────────────┐
 * │                    TOP                     │
 * ├────┬────┬────┬────┬────┬────┬────┬────┬────┤
 * │    │ A1 │ B1 │ C1 │    │ E1 │ F1 │ G1 │    │
 * │    │    ├────┼────┤    ├────┴────┤    │    │
 * │    │    │ B2 │ C2 │ D1 │ E2      │    │    │
 * │ TL │    │    ├────┤    │         │    │ TR │
 * │    │    │    │ C3 │    │         │    │    │
 * │    ├────┴────┴────┴────┴─────────┴────┤    │
 * │    │                A2                │    │
 * ├────┴──────────────────────────────────┴────┤
 * │                   CLEAR                    │
 * ├────┬──────────────────────────────────┬────┤
 * │    │                A3                │    │
 * │    ├──────────────┬────┬─────────┬────┤    │
 * │    │      A4      │    │   E3    │    │    │
 * │ BL ├────┬─────────┤ D2 ├────┬────┤    │ BR │
 * │    │    │   B3    │    │    │    │ G2 │    │
 * │    │ A5 ├────┬────┴────┤ E4 │ F3 │    │    │
 * │    │    │ B4 │   C4    │    │    │    │    │
 * ├────┴────┴────┴─────────┴────┴────┴────┴────┤
 * │                   BOTTOM                   │
 * └────────────────────────────────────────────┘
 */

console.log("\nExample with complex layout:");

const table = createTable();

table.addRows(
    [{ colSpan: 9, content: "TOP", hAlign: "center" }],
    [
        { content: "TL", rowSpan: 4, vAlign: "middle" },
        { content: "A1", rowSpan: 3 },
        "B1",
        "C1",
        { content: "D1", rowSpan: 3, vAlign: "middle" },
        "E1",
        "F1",
        { content: "G1", rowSpan: 3 },
        { content: "TR", rowSpan: 4, vAlign: "middle" },
    ],
    [{ content: "B2", rowSpan: 2 }, "C2", { colSpan: 2, content: "E2", rowSpan: 2 }],
    ["C3"],
    [{ colSpan: 7, content: "A2", hAlign: "center" }],
    [{ colSpan: 9, content: "CLEAR", hAlign: "center" }],
    [
        { content: "BL", rowSpan: 4, vAlign: "middle" },
        { colSpan: 7, content: "A3", hAlign: "center" },
        { content: "BR", rowSpan: 4, vAlign: "middle" },
    ],
    [
        { colSpan: 3, content: "A4", hAlign: "center" },
        { content: "D2", rowSpan: 2, vAlign: "middle" },
        { colSpan: 2, content: "E3", hAlign: "center" },
        { content: "G2", rowSpan: 3, vAlign: "middle" },
    ],
    [
        { content: "A5", rowSpan: 2, vAlign: "middle" },
        { colSpan: 2, content: "B3", hAlign: "center" },
        { content: "E4", rowSpan: 2, vAlign: "middle" },
        { content: "F3", rowSpan: 2, vAlign: "middle" },
    ],
    ["B4", { colSpan: 2, content: "C4", hAlign: "center" }],
    [{ colSpan: 9, content: "BOTTOM", hAlign: "center" }],
);

console.log(table.toString());
