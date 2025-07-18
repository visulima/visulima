import { blue, gray, green, magenta, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";
import {
    ASCII_BORDER,
    BLOCK_BORDER,
    DEFAULT_BORDER,
    DOTS_BORDER,
    DOUBLE_BORDER,
    INNER_HALF_BLOCK_BORDER,
    MARKDOWN_BORDER,
    MINIMAL_BORDER,
    NO_BORDER,
    OUTER_HALF_BLOCK_BORDER,
    ROUNDED_BORDER,
    THICK_BORDER,
} from "../src/style";

describe("table borders", () => {
    describe("border styles", () => {
        const sampleData = [
            ["Header 1", "Header 2", "Header 3"],
            ["Row 1 Cell 1", "Row 1 Cell 2", "Row 1 Cell 3"],
            ["Row 2 Cell 1", "Row 2 Cell 2", "Row 2 Cell 3"],
        ];

        it.each([
            ["DEFAULT", DEFAULT_BORDER],
            ["MINIMAL", MINIMAL_BORDER],
            ["DOUBLE", DOUBLE_BORDER],
            ["ROUNDED", ROUNDED_BORDER],
            ["DOTS", DOTS_BORDER],
            ["MARKDOWN", MARKDOWN_BORDER],
            // eslint-disable-next-line unicorn/text-encoding-identifier-case
            ["ASCII", ASCII_BORDER],
            ["NO_BORDER", NO_BORDER],
            ["BLOCK", BLOCK_BORDER],
            ["OUTER_HALF_BLOCK", OUTER_HALF_BLOCK_BORDER],
            ["INNER_HALF_BLOCK", INNER_HALF_BLOCK_BORDER],
            ["THICK", THICK_BORDER],
        ])("renders table with %s border style", (_, borderStyle) => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: borderStyle,
                },
            });

            // Add a check for sampleData[0]
            // eslint-disable-next-line vitest/no-conditional-in-test
            if (!sampleData[0]) {
                throw new Error("Sample data is missing header row for border style test.");
            }

            table.setHeaders(sampleData[0]);
            table.addRows(...sampleData.slice(1));

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("should support colored borders", () => {
            expect.assertions(3);

            const table = new Table({
                style: {
                    border: {
                        bodyJoin: { char: gray("│"), width: 1 },
                        bodyLeft: { char: gray("│"), width: 1 },
                        bodyRight: { char: gray("│"), width: 1 },
                        bottomBody: { char: gray("─"), width: 1 },
                        bottomJoin: { char: gray("┴"), width: 1 },
                        bottomLeft: { char: gray("└"), width: 1 },
                        bottomRight: { char: gray("┘"), width: 1 },
                        joinBody: { char: gray("─"), width: 1 },
                        joinJoin: { char: gray("┼"), width: 1 },
                        joinLeft: { char: gray("├"), width: 1 },
                        joinRight: { char: gray("┤"), width: 1 },
                        topBody: { char: gray("─"), width: 1 },
                        topJoin: { char: gray("┬"), width: 1 },
                        topLeft: { char: gray("┌"), width: 1 },
                        topRight: { char: gray("┐"), width: 1 },
                    },
                },
            });

            table.setHeaders(["Header 1", "Header 2"]).addRow([red("Value 1"), "Value 2"]);

            const output = table.toString();

            // Use toContain for simpler ANSI code checks
            expect(output).toContain("\u001B[90m"); // gray
            expect(output).toContain("\u001B[31m"); // red
            expect(output).toMatchSnapshot("table-colored-borders");
        });

        it("should support multiple different colors for various border components", () => {
            expect.assertions(6);

            // Based on examples/colorized-border.js
            const table = createTable({
                style: {
                    border: {
                        bodyJoin: { char: blue("│"), width: 1 },
                        bodyLeft: { char: blue("│"), width: 1 },
                        bodyRight: { char: blue("│"), width: 1 },
                        bottomBody: { char: red("─"), width: 1 },
                        bottomJoin: { char: red("┴"), width: 1 },
                        bottomLeft: { char: red("└"), width: 1 },
                        bottomRight: { char: red("┘"), width: 1 },
                        // Assuming headerJoin is handled by joinBody/topJoin etc based on context
                        joinBody: { char: magenta("─"), width: 1 },
                        joinJoin: { char: magenta("┼"), width: 1 },
                        joinLeft: { char: magenta("├"), width: 1 },
                        joinRight: { char: magenta("┤"), width: 1 },
                        topBody: { char: green("─"), width: 1 },
                        topJoin: { char: green("┬"), width: 1 },
                        topLeft: { char: green("┌"), width: 1 },
                        topRight: { char: green("┐"), width: 1 },
                    },
                },
            });

            table
                .setHeaders([
                    { content: "Server", hAlign: "center" },
                    { content: "Load", hAlign: "center" },
                    { content: "Uptime", hAlign: "right" },
                    { content: "Status", hAlign: "center" },
                ])
                .addRow(["API Server", green("28%"), "24d 12h", green("● Online")])
                .addRow(["Database", yellow("78%"), "15d 6h", yellow("● Warning")])
                .addRow(["Cache", red("92%"), "7d 3h", red("● Critical")]);

            const output = table.toString();

            // Basic checks for color codes
            expect(output).toContain("\u001B[34m"); // blue
            expect(output).toContain("\u001B[31m"); // red
            expect(output).toContain("\u001B[35m"); // magenta
            expect(output).toContain("\u001B[32m"); // green
            expect(output).toContain("\u001B[33m"); // yellow

            expect(output).toMatchSnapshot("table-multi-colored-borders");
        });

        it("should support custom border characters", () => {
            expect.assertions(2);

            const table = new Table({
                style: {
                    border: {
                        bodyJoin: { char: "│", width: 1 },
                        bodyLeft: { char: "║", width: 1 },
                        bodyRight: { char: "║", width: 1 },
                        bottomBody: { char: "═", width: 1 },
                        bottomJoin: { char: "╧", width: 1 },
                        bottomLeft: { char: "╚", width: 1 },
                        bottomRight: { char: "╝", width: 1 },
                        joinBody: { char: "─", width: 1 },
                        joinJoin: { char: "┼", width: 1 },
                        joinLeft: { char: "╟", width: 1 },
                        joinRight: { char: "╢", width: 1 },
                        topBody: { char: "═", width: 1 },
                        topJoin: { char: "╤", width: 1 },
                        topLeft: { char: "╔", width: 1 },
                        topRight: { char: "╗", width: 1 },
                    },
                },
            });

            table.addRows(["foo", "bar", "baz"], ["frob", "bar", "quuz"]);

            const expected = ["╔══════╤═════╤══════╗", "║ foo  │ bar │ baz  ║", "╟──────┼─────┼──────╢", "║ frob │ bar │ quuz ║", "╚══════╧═════╧══════╝"].join(
                "\n",
            );

            expect(table.toString()).toBe(expected);
            expect(table.toString()).toMatchSnapshot("table-custom-borders");
        });

        it("should support disabled decoration lines (NO_BORDER specific)", () => {
            expect.assertions(1);

            const table = createTable({ style: { border: NO_BORDER, paddingLeft: 1, paddingRight: 1 } });

            table.addRows(["foo", "bar", "baz"], ["frobnicate", "bar", "quuz"]);

            expect(table.toString()).toMatchSnapshot("table-no-border-specific");
        });

        it("renders table with spanning cells using DEFAULT border style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: DEFAULT_BORDER,
                },
            });

            table.setHeaders(["Spanning Header", "Regular Header"]);
            table.addRows([{ colSpan: 2, content: "Spanning Content" }], ["Regular Cell 1", "Regular Cell 2"]);

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with multiline content using DOUBLE border style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: DOUBLE_BORDER,
                },
            });

            table.setHeaders(["Multiline Header", "Regular Header"]);
            table.addRows(["Line 1\nLine 2\nLine 3", "Regular Cell"], ["Regular Cell 1", "Regular Cell 2"]);

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with mixed alignments using ROUNDED border style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: ROUNDED_BORDER,
                },
            });

            table.setHeaders([
                { content: "Left Align", hAlign: "left" },
                { content: "Center Align", hAlign: "center" },
                { content: "Right Align", hAlign: "right" },
            ]);
            table.addRows(["Short", "Medium Text", "Longer Text Here"], ["A", "BB", "CCC"]);

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with vertical alignments using DOTS border style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: DOTS_BORDER,
                },
            });

            table.setHeaders([
                { content: "Top\nAlign", vAlign: "top" },
                { content: "Middle\nAlign", vAlign: "middle" },
                { content: "Bottom\nAlign", vAlign: "bottom" },
            ]);
            table.addRows([
                { content: "Short", vAlign: "top" },
                { content: "Medium\nText", vAlign: "middle" },
                { content: "Long\nText\nHere", vAlign: "bottom" },
            ]);

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with word wrapping using MARKDOWN border style", () => {
            expect.assertions(1);

            const table = createTable({
                columnWidths: [8, 13],
                style: {
                    border: MARKDOWN_BORDER,
                },
                wordWrap: true,
            });

            table.setHeaders(["Short Header", "Long Header That Should Wrap"]);
            table.addRows(
                ["Short", "This is a very long cell content that should be wrapped across multiple lines"],
                ["Also Short", "Another long content that needs to be wrapped to maintain readability"],
            );

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with truncated content using ASCII border style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: ASCII_BORDER,
                },
            });

            table.setHeaders([{ content: "Truncated Header", maxWidth: 10 }, { content: "Regular Header" }]);
            table.addRows(
                [{ content: "This content should be truncated", maxWidth: 10 }, "Regular Cell"],
                [{ content: "Also truncated content here", maxWidth: 10 }, "Another Regular Cell"],
            );

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });

        it("renders table with mixed styling using NO_BORDER style", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    border: NO_BORDER,
                    paddingLeft: 2,
                    paddingRight: 2,
                },
            });

            table.setHeaders([
                { content: "Mixed", hAlign: "left", vAlign: "top" },
                { content: "Styling", hAlign: "center", vAlign: "middle" },
                { content: "Example", hAlign: "right", vAlign: "bottom" },
            ]);
            table.addRows([
                { content: "Left\nTop", hAlign: "left", vAlign: "top" },
                { content: "Center\nMiddle", hAlign: "center", vAlign: "middle" },
                { content: "Right\nBottom", hAlign: "right", vAlign: "bottom" },
            ]);

            const output = table.toString();

            expect(output).toMatchSnapshot();
        });
    });

    describe("cell alignment", () => {
        it("should support different cell alignments with borders", () => {
            expect.assertions(8);

            const table = new Table();

            table
                .setHeaders([
                    { content: "Left", hAlign: "left" },
                    { content: "Center", hAlign: "center" },
                    { content: "Right", hAlign: "right" },
                ])
                .addRow([
                    { content: "1", hAlign: "left" },
                    { content: "2", hAlign: "center" },
                    { content: "3", hAlign: "right" },
                ]);

            const output = table.toString();
            const lines = output.split("\n");
            const dataLine = lines.find((line) => line.includes("1"));

            expect(dataLine).toBeDefined();

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (!dataLine) {
                throw new Error("Data line not found in table output");
            }

            const cells = dataLine.split("│");

            expect(cells[1]).toBeDefined();
            expect(cells[1]?.trimEnd()).toBe(" 1");

            expect(cells[2]).toBeDefined();
            expect(cells[2]?.trim()).toBe("2");

            expect(cells[3]).toBeDefined();
            expect(cells[3]?.trimStart()).toBe("3 ");

            expect(output).toMatchSnapshot("table-alignment-with-borders");
        });
    });

    describe("padding configuration", () => {
        it("should respect padding settings with borders", () => {
            expect.assertions(4);

            const table = new Table({
                style: {
                    paddingLeft: 2,
                    paddingRight: 2,
                },
            });

            table.addRow(["A", "B"]);

            const output = table.toString();
            const lines = output.split("\n");

            const dataLine = lines.find((line) => line.includes("A"));

            expect(dataLine).toBeDefined();

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (!dataLine) {
                throw new Error("Data line not found for padding test");
            }

            const cells = dataLine.split("│");

            expect(cells[1]).toBe("  A  ");
            expect(cells[2]).toBe("  B  ");
            expect(output).toMatchSnapshot("table-padding-with-borders");
        });

        it("should handle zero padding", () => {
            expect.assertions(2);

            const table = new Table({
                style: {
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });

            table.addRow(["A", "B"]);

            const expected = ["┌─┬─┐", "│A│B│", "└─┴─┘"].join("\n");

            expect(table.toString()).toBe(expected);
            expect(table.toString()).toMatchSnapshot("table-zero-padding");
        });
    });

    describe("specific join character logic", () => {
        it("should render correct join char ('┬') when only row above spans horizontally", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([{ colSpan: 2, content: "Span Above" }]);
            table.addRow(["A", "B"]);

            // Expecting '┬' (topJoin) between A and B in the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌─────────────┐
                │ Span Above  │
                ├──────┬──────┤
                │ A    │ B    │
                └──────┴──────┘"
            `);
        });

        it("should render correct join char ('┴') when only row below spans horizontally", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow(["A", "B"]);
            table.addRow([{ colSpan: 2, content: "Span Below" }]);

            // Expecting '┴' (bottomJoin) between A and B in the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌──────┬──────┐
                │ A    │ B    │
                ├──────┴──────┤
                │ Span Below  │
                └─────────────┘"
            `);
        });

        it("should render correct join char ('─') when both rows span horizontally", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([{ colSpan: 2, content: "Span Above" }]);
            table.addRow([{ colSpan: 2, content: "Span Below" }]);

            // Expecting '─' (joinBody) between A and B in the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌─────────────┐
                │ Span Above  │
                ├─────────────┤
                │ Span Below  │
                └─────────────┘"
            `);
        });

        it("should render correct join char ('├') when only left cell spans vertically", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([{ content: "Span Left", rowSpan: 2 }, "A"]);
            table.addRow(["B"]);

            // Expecting '├' (joinLeft) on the left edge of the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───────────┬───┐
                │ Span Left │ A │
                │           ├───┤
                │           │ B │
                └───────────┴───┘"
            `);
        });

        it("should render correct join char ('┤') when only right cell spans vertically", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow(["A", { content: "Span Right", rowSpan: 2 }]);
            table.addRow(["B"]);

            // Expecting '┤' (joinRight) on the right edge of the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───┬────────────┐
                │ A │ Span Right │
                ├───┤            │
                │ B │            │
                └───┴────────────┘"
            `);
        });

        it("should render correct join char ('│') when different cells span vertically", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([
                { content: "Span Left", rowSpan: 2 },
                { content: "Span Right", rowSpan: 2 },
            ]);

            // Expecting '│' (bodyJoin) in the middle of the middle border
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───────────┬────────────┐
                │ Span Left │ Span Right │
                │           │            │
                └───────────┴────────────┘"
            `);
        });

        it("should render correct join char (' ') when the same cell spans vertically and horizontally", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow([{ colSpan: 2, content: "Span Both", rowSpan: 2 }]);

            // Expecting space where the internal border would be
            expect(table.toString()).toMatchInlineSnapshot(`
                "┌───────────┐
                │ Span Both │
                │           │
                └───────────┘"
            `);
        });
    });

    describe("border rendering variations", () => {
        it("should render no borders if borderType is 'none' in renderHorizontalBorder", async () => {
            expect.assertions(1);

            const table = createTable({ style: { border: NO_BORDER } }); // Use NO_BORDER style

            table.addRow(["A", "B"]);
            table.addRow(["C", "D"]);

            await expect(table.toString()).toMatchFileSnapshot("table-no-borders");
        });
    });
});
