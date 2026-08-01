import { getStringWidth } from "@visulima/string";
import { describe, expect, it } from "vitest";

import { clearTerminalWidthCache, createGrid, createTable, Table } from "../../src";
import { DEFAULT_BORDER } from "../../src/style";

/** Width of every rendered line, so a table can be checked for a ragged right edge. */
const lineWidths = (rendered: string): Set<number> => new Set(rendered.split("\n").map((line) => getStringWidth(line)));

describe("tabular in workerd", () => {
    it("should run inside the workers runtime", () => {
        expect.assertions(2);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `navigator` is a workerd global, not a Node builtin
        expect((globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent).toBe("Cloudflare-Workers");
        // No TTY is attached to `process.stdout` in a Worker, which is what the width probe has
        // to cope with.
        expect(process.stdout.columns).toBeUndefined();
    });

    describe("terminal width detection without a TTY", () => {
        it("should fall back to a finite default width instead of NaN", () => {
            expect.assertions(3);

            clearTerminalWidthCache();

            const table = createTable();

            table.setHeaders(["h"]).addRow(["x".repeat(200)]);

            const rendered = table.toString();

            // 80 columns is the documented fallback when no TTY can be probed.
            expect(lineWidths(rendered)).toStrictEqual(new Set([80]));
            expect(rendered).not.toContain("NaN");
            expect(rendered).not.toContain("undefined");
        });

        it("should not throw when the width cache is cleared repeatedly", () => {
            expect.assertions(1);

            clearTerminalWidthCache();
            clearTerminalWidthCache();

            expect(() => createGrid({ columns: 2 }).addItems(["a", "b"]).toString()).not.toThrow();
        });

        it("should honour an explicit terminalWidth over the probe", () => {
            expect.assertions(1);

            const table = createTable({ terminalWidth: 30 });

            table.setHeaders(["h"]).addRow(["x".repeat(200)]);

            expect(lineWidths(table.toString())).toStrictEqual(new Set([30]));
        });

        it("should clamp maxWidth to the detected terminal width", () => {
            expect.assertions(1);

            clearTerminalWidthCache();

            const grid = createGrid({ columns: 1, maxWidth: 500 });

            grid.addItems(["y".repeat(300)]);

            const widths = [...lineWidths(grid.toString())];

            expect(Math.max(...widths)).toBeLessThanOrEqual(80);
        });
    });

    describe("table layout", () => {
        it("should render headers and body rows", () => {
            expect.assertions(1);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["Name", "Age"]).addRow(["Alice", 30]).addRow(["Bob", 7]);

            expect(table.toString()).toStrictEqual(
                [
                    "┌───────┬─────┐",
                    "│ Name  │ Age │",
                    "├───────┼─────┤",
                    "│ Alice │ 30  │",
                    "├───────┼─────┤",
                    "│ Bob   │ 7   │",
                    "└───────┴─────┘",
                ].join("\n"),
            );
        });

        it("should apply per-column alignment", () => {
            expect.assertions(1);

            const table = createTable({ colAligns: ["left", "right", "center"], terminalWidth: 80 });

            table.setHeaders(["a", "b", "c"]).addRow(["x", "yy", "zzz"]);

            expect(table.toString()).toStrictEqual(
                ["┌───┬────┬─────┐", "│ a │  b │  c  │", "├───┼────┼─────┤", "│ x │ yy │ zzz │", "└───┴────┴─────┘"].join("\n"),
            );
        });

        it("should render a footer row", () => {
            expect.assertions(2);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["Name", "Qty"]).addRow(["Bolt", 2]).setFooter(["Total", 2]);

            const rendered = table.toString();

            expect(rendered).toContain("Total");
            expect(lineWidths(rendered).size).toBe(1);
        });

        it("should honour paddingLeft and paddingRight", () => {
            expect.assertions(1);

            const table = new Table({ showHeader: false, style: { paddingLeft: 0, paddingRight: 0 }, terminalWidth: 80 });

            table.addRow(["a", "b"]);

            expect(table.toString()).toStrictEqual(["┌─┬─┐", "│a│b│", "└─┴─┘"].join("\n"));
        });

        it("should span columns in a header", () => {
            expect.assertions(1);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders([{ colSpan: 2, content: "Header" }]).addRow(["a", "b"]);

            expect(table.toString()).toStrictEqual(["┌─────────┐", "│ Header  │", "├────┬────┤", "│ a  │ b  │", "└────┴────┘"].join("\n"));
        });

        it("should span rows without leaving a ragged edge", () => {
            expect.assertions(2);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["a", "b"]).addRow([{ content: "tall", rowSpan: 2 }, "one"]).addRow(["two"]);

            const rendered = table.toString();

            expect(lineWidths(rendered).size).toBe(1);
            expect(rendered).toContain("tall");
        });
    });

    describe("column sizing", () => {
        it("should truncate content to fixed column widths", () => {
            expect.assertions(1);

            const table = createTable({ columnWidths: [10, 6], terminalWidth: 80, truncate: true });

            table.setHeaders(["Long header text", "Second"]).addRow(["a very long cell value", "short"]);

            expect(table.toString()).toStrictEqual(
                ["┌──────────┬──────┐", "│ Long he… │ Sec… │", "├──────────┼──────┤", "│ a very … │ sho… │", "└──────────┴──────┘"].join("\n"),
            );
        });

        it("should word wrap content inside a fixed column width", () => {
            expect.assertions(1);

            const table = createTable({ columnWidths: [12], terminalWidth: 80, wordWrap: true });

            table.setHeaders(["Description"]).addRow(["the quick brown fox jumps"]);

            expect(table.toString()).toStrictEqual(
                ["┌────────────┐", "│ Descripti… │", "├────────────┤", "│ the quick  │", "│ brown fox  │", "│ jumps      │", "└────────────┘"].join("\n"),
            );
        });

        it("should respect a per-cell maxWidth", () => {
            expect.assertions(1);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["k"]).addRow([{ content: "an extremely long value", maxWidth: 8 }]);

            expect(lineWidths(table.toString())).toStrictEqual(new Set([12]));
        });
    });

    describe("ansi and unicode awareness", () => {
        it("should keep ANSI escapes out of the measured width", () => {
            expect.assertions(2);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["k", "v"]).addRow(["\u001B[31mred\u001B[39m", "plain"]);

            const rendered = table.toString();

            expect(rendered).toContain("\u001B[31mred\u001B[39m");
            expect(rendered).toStrictEqual(
                ["┌─────┬───────┐", "│ k   │ v     │", "├─────┼───────┤", "│ \u001B[31mred\u001B[39m │ plain │", "└─────┴───────┘"].join("\n"),
            );
        });

        it("should truncate ANSI content without leaking a dangling escape width", () => {
            expect.assertions(1);

            const table = createTable({ columnWidths: [8], terminalWidth: 80, truncate: true });

            table.setHeaders(["v"]).addRow(["\u001B[32mgreen and very long\u001B[39m"]);

            expect(lineWidths(table.toString())).toStrictEqual(new Set([10]));
        });

        it("should measure CJK and emoji as two columns", () => {
            expect.assertions(1);

            const table = createTable({ terminalWidth: 80 });

            table.setHeaders(["cjk", "emoji"]).addRow(["你好世界", "🦄🌈"]);

            expect(table.toString()).toStrictEqual(
                ["┌──────────┬───────┐", "│ cjk      │ emoji │", "├──────────┼───────┤", "│ 你好世界 │ 🦄🌈  │", "└──────────┴───────┘"].join("\n"),
            );
        });
    });

    describe("grid", () => {
        it("should flow items across the configured columns", () => {
            expect.assertions(1);

            const grid = createGrid({ columns: 3, terminalWidth: 80 });

            grid.addItems(["1", "2", "3", "4"]);

            expect(grid.toString()).toStrictEqual([" 1  2  3 ", " 4       "].join("\n"));
        });

        it("should separate columns by the configured gap", () => {
            expect.assertions(1);

            const grid = createGrid({ columns: 2, gap: 2, terminalWidth: 80 });

            grid.addItems(["1", "2", "3", "4"]);

            expect(grid.toString()).toStrictEqual([" 1      2 ", " 3      4 "].join("\n"));
        });

        it("should draw borders around grid cells", () => {
            expect.assertions(1);

            const grid = createGrid({ border: DEFAULT_BORDER, columns: 2, showBorders: true, terminalWidth: 80 });

            grid.addItems(["ab", "cd", "ef", "gh"]);

            expect(grid.toString()).toStrictEqual(["┌────┬────┐", "│ ab │ cd │", "├────┼────┤", "│ ef │ gh │", "└────┴────┘"].join("\n"));
        });
    });

    describe("diagnostics", () => {
        it("should route warnings to onWarn instead of console.warn", () => {
            expect.assertions(1);

            const warnings: string[] = [];
            const grid = createGrid({ columns: 2, onWarn: (message) => warnings.push(message), terminalWidth: 80 });

            grid.addItem({ colSpan: 5, content: "too wide" });
            grid.toString();

            expect(warnings.length).toBeGreaterThan(0);
        });

        it("should reject a non-array row", () => {
            expect.assertions(1);

            // @ts-expect-error - invalid row
            expect(() => createTable().addRow("nope")).toThrow("Row must be an array");
        });
    });
});
