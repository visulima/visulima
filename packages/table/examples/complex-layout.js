import { createTable } from "../dist/index.mjs";

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
let table = createTable();
table.addRows(
    [{ content: 'TOP', colSpan: 9, hAlign: 'center' }],
    [
        { content: 'TL', rowSpan: 4, vAlign: 'middle' },
        { content: 'A1', rowSpan: 3 },
        'B1',
        'C1',
        { content: 'D1', rowSpan: 3, vAlign: 'middle' },
        'E1',
        'F1',
        { content: 'G1', rowSpan: 3 },
        { content: 'TR', rowSpan: 4, vAlign: 'middle' },
    ],
    [{ rowSpan: 2, content: 'B2' }, 'C2', { rowSpan: 2, colSpan: 2, content: 'E2' }],
    ['C3'],
    [{ content: 'A2', colSpan: 7, hAlign: 'center' }],
    [{ content: 'CLEAR', colSpan: 9, hAlign: 'center' }],
    [
        { content: 'BL', rowSpan: 4, vAlign: 'middle' },
        { content: 'A3', colSpan: 7, hAlign: 'center' },
        { content: 'BR', rowSpan: 4, vAlign: 'middle' },
    ],
    [
        { content: 'A4', colSpan: 3, hAlign: 'center' },
        { content: 'D2', rowSpan: 2, vAlign: 'middle' },
        { content: 'E3', colSpan: 2, hAlign: 'center' },
        { content: 'G2', rowSpan: 3, vAlign: 'middle' },
    ],
    [
        { content: 'A5', rowSpan: 2, vAlign: 'middle' },
        { content: 'B3', colSpan: 2, hAlign: 'center' },
        { content: 'E4', rowSpan: 2, vAlign: 'middle' },
        { content: 'F3', rowSpan: 2, vAlign: 'middle' },
    ],
    ['B4', { content: 'C4', colSpan: 2, hAlign: 'center' }],
    [{ content: 'BOTTOM', colSpan: 9, hAlign: 'center' }]
);

console.log(table.toString());
