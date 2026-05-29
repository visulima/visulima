import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTable, Grid } from "../src";
import { DEFAULT_BORDER } from "../src/style";

describe("grid edge cases", () => {
    describe("fixedRowHeights as a number", () => {
        it("applies a single numeric fixedRowHeights to every row", () => {
            expect.assertions(1);

            const grid = new Grid({ border: DEFAULT_BORDER, columns: 1, fixedRowHeights: 2 });

            grid.addItem("A");
            grid.addItem("B");

            expect(grid.toString()).toMatchInlineSnapshot(`
                "┌───┐
                │ A │
                │   │
                ├───┤
                │ B │
                │   │
                └───┘"
            `);
        });
    });

    describe("autoFlow column with empty cells", () => {
        let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        });

        afterEach(() => {
            consoleWarnSpy.mockRestore();
        });

        it("advances the cursor for an empty cell in a dynamic-height column flow", () => {
            expect.assertions(1);

            const grid = new Grid({ autoFlow: "column", border: DEFAULT_BORDER, columns: 2 });

            // A null cell normalizes to the internal empty-cell representation, which triggers the
            // column-flow cursor advance in an initially empty (dynamic-height) grid.
            grid.addItem(null);
            grid.addItem("A");
            grid.addItem("B");
            grid.addItem("C");

            expect(grid.toString()).toContain("A");
        });

        it("wraps the cursor for an empty cell in a fixed-row column flow", () => {
            expect.assertions(1);

            const grid = new Grid({ autoFlow: "column", border: DEFAULT_BORDER, columns: 2, rows: 2 });

            grid.addItem("A");
            grid.addItem("B");
            grid.addItem(null); // Empty cell wraps the column based on the fixed rows count
            grid.addItem("D");

            expect(grid.toString()).toContain("A");
        });
    });

    describe("terminal width adjustment", () => {
        it("collapses every column to width 1 when fixed structure exceeds the max width", () => {
            expect.assertions(1);

            const table = createTable({ maxWidth: 6, style: { paddingLeft: 0, paddingRight: 0 } });

            table.addRow(["aaa", "bbb", "ccc", "ddd", "eee"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌─┬─┬─┬─┬─┐
                │…│…│…│…│…│
                └─┴─┴─┴─┴─┘"
            `);
        });

        it("distributes balanced width evenly when every column is empty", () => {
            expect.assertions(1);

            // All-empty content means the minimum-width total is 0, so the balanced calculation
            // falls back to an even distribution of the available width.
            const table = createTable({ balancedWidths: true, style: { paddingLeft: 0, paddingRight: 0 }, terminalWidth: 30 });

            table.addRow(["", "", ""]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌────────┬────────┬────────┐
                │        │        │        │
                └────────┴────────┴────────┘"
            `);
        });
    });

    describe("balancedWidths with fixed-width holes", () => {
        it("fills only the undefined columns when balancing fixed widths", () => {
            expect.assertions(1);

            const table = createTable({
                balancedWidths: true,
                columnWidths: [3, undefined, undefined],
                style: { paddingLeft: 0, paddingRight: 0 },
                terminalWidth: 20,
            });

            table.addRow(["X", "Y", "Z"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───┬───────┬──────┐
                │X  │Y      │Z     │
                └───┴───────┴──────┘"
            `);
        });
    });

    describe("balancedWidths with spanning cells", () => {
        it("balances a column-spanning cell across its columns", () => {
            expect.assertions(1);

            const table = createTable({ balancedWidths: true, style: { paddingLeft: 0, paddingRight: 0 }, terminalWidth: 40 });

            table.setHeaders([{ colSpan: 3, content: "Wide Spanning Header" }]);
            table.addRow(["a", "b", "c"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌──────────────────────────────────────┐
                │Wide Spanning Header                  │
                ├────────────┬────────────┬────────────┤
                │a           │b           │c           │
                └────────────┴────────────┴────────────┘"
            `);
        });

        it("distributes extra width to growable wrapping columns that also span", () => {
            expect.assertions(1);

            const table = createTable({ balancedWidths: true, style: { paddingLeft: 0, paddingRight: 0 }, terminalWidth: 60, wordWrap: true });

            table.addRow([{ colSpan: 2, content: "spanning content that wraps across" }, "x"]);
            table.addRow(["short", "y", "z"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───────────────────────────────────────┬──────────────────┐
                │spanning content that wraps across     │x                 │
                ├───────────────────┬───────────────────┼──────────────────┤
                │short              │y                  │z                 │
                └───────────────────┴───────────────────┴──────────────────┘"
            `);
        });
    });

    describe("rowSpan placement growth", () => {
        it("grows the grid layout for a rowSpan cell in column flow", () => {
            expect.assertions(1);

            const grid = new Grid({ autoFlow: "column", border: DEFAULT_BORDER, columns: 2 });

            grid.addItem({ content: "tall", rowSpan: 3 });
            grid.addItem("b");

            expect(grid.toString()).toMatchInlineSnapshot(`
                "┌──────┬───┐
                │ tall │ b │
                │      ├───┤
                │      │   │
                │      │   │
                └──────┴───┘"
            `);
        });
    });
});
