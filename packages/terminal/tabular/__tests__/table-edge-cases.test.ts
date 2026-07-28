import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";

describe("table edge cases", () => {
    describe("setHeaders / setFooter normalization", () => {
        it("wraps a non-array element inside a 2D headers input", () => {
            expect.assertions(1);

            const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 } });

            // First element is an array (-> 2D path); the trailing string element must be wrapped to a row.
            table.setHeaders([["A", "B"], "C"]);
            table.addRow(["x", "y"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌─┬─┐
                │A│B│
                ├─┴─┤
                │C  │
                ├─┬─┤
                │x│y│
                └─┴─┘"
            `);
        });

        it("wraps a non-array element inside a 2D footers input", () => {
            expect.assertions(1);

            const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 } });

            table.setHeaders(["A", "B"]);
            table.addRow(["x", "y"]);
            table.setFooter([["F1", "F2"], "F3"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌──┬──┐
                │A │B │
                ├──┼──┤
                │x │y │
                ├──┼──┤
                │F1│F2│
                ├──┴──┤
                │F3   │
                └─────┘"
            `);
        });
    });

    describe("render caching", () => {
        it("returns the cached string on a second toString call without mutation", () => {
            expect.assertions(2);

            const table = createTable();

            table.setHeaders(["A"]);
            table.addRow(["x"]);

            const first = table.toString();
            const second = table.toString();

            expect(second).toBe(first);
            expect(second).toContain("A");
        });

        it("re-renders after a mutation invalidates the cache", () => {
            expect.assertions(2);

            const table = createTable();

            table.setHeaders(["A"]);
            table.addRow(["x"]);

            const first = table.toString();

            table.addRow(["y"]);

            const second = table.toString();

            expect(second).not.toBe(first);
            expect(second).toContain("y");
        });
    });

    describe("column dimension edge cases", () => {
        it("returns an empty string when every row resolves to zero columns", () => {
            expect.assertions(1);

            const table = new Table({ showHeader: false });

            table.addRow([]);
            table.addRow([]);

            expect(table.toString()).toBe("");
        });

        it("pads a columnWidths array that is shorter than the number of columns", () => {
            expect.assertions(1);

            // columnWidths only provides a value for the first column; the array is padded with
            // undefined for the remaining auto-sized columns before being handed to the grid.
            const table = createTable({ columnWidths: [10], style: { paddingLeft: 0, paddingRight: 0 } });

            table.addRow(["abc", "B", "C"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌──────────┬─┬─┐
                │abc       │B│C│
                └──────────┴─┴─┘"
            `);
        });
    });

    describe("transformTabToSpace", () => {
        it("replaces tab characters with the configured number of spaces", () => {
            expect.assertions(1);

            const table = createTable({ style: { paddingLeft: 0, paddingRight: 0 }, transformTabToSpace: 4 });

            table.addRow(["a\tb"]);

            expect(table.toString()).toMatchInlineSnapshot(`
                "┌──────┐
                │a    b│
                └──────┘"
            `);
        });
    });
});
