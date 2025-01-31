import { gray, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { Table } from "../src";
import { DEFAULT_BORDER, DOUBLE_BORDER, MARKDOWN_BORDER, MINIMAL_BORDER, NO_BORDER, ROUNDED_BORDER } from "../src/style";

describe("table borders", () => {
    describe("border styles", () => {
        it.each([
            ["default", DEFAULT_BORDER],
            ["minimal", MINIMAL_BORDER],
            ["markdown", MARKDOWN_BORDER],
            ["double", DOUBLE_BORDER],
            ["rounded", ROUNDED_BORDER],
        ])("should support %s border style", (styleName, borderStyle) => {
            expect.assertions(1);

            const table = new Table({
                style: {
                    border: borderStyle,
                },
            });

            table.setHeaders(["Header 1", "Header 2"]).addRow(["Value 1", "Value 2"]);

            const output = table.toString();

            expect(output).toMatchSnapshot(`table-${styleName}-style`);
        });

        it("should support colored borders", () => {
            const table = new Table({
                style: {
                    border: {
                        bodyJoin: gray("│"),
                        bodyLeft: gray("│"),
                        bodyRight: gray("│"),
                        bottomBody: gray("─"),
                        bottomJoin: gray("┴"),
                        bottomLeft: gray("└"),
                        bottomRight: gray("┘"),
                        joinBody: gray("─"),
                        joinJoin: gray("┼"),
                        joinLeft: gray("├"),
                        joinRight: gray("┤"),
                        topBody: gray("─"),
                        topJoin: gray("┬"),
                        topLeft: gray("┌"),
                        topRight: gray("┐"),
                    },
                },
            });

            table.setHeaders(["Header 1", "Header 2"]).addRow([red("Value 1"), "Value 2"]);

            const output = table.toString();

            // Verify that the output contains ANSI color codes for both border and content
            expect(output).toMatch(/\u001B\[90m.*\u001B\[39m/); // gray border
            expect(output).toMatch(/\u001B\[31m.*\u001B\[39m/); // red content
        });

        it("should support custom border characters", () => {
            const table = new Table({
                style: {
                    border: {
                        bodyJoin: "│",
                        bodyLeft: "║",
                        bodyRight: "║",
                        bottomBody: "═",
                        bottomJoin: "╧",
                        bottomLeft: "╚",
                        bottomRight: "╝",
                        joinBody: "─",
                        joinJoin: "┼",
                        joinLeft: "╟",
                        joinRight: "╢",
                        topBody: "═",
                        topJoin: "╤",
                        topLeft: "╔",
                        topRight: "╗",
                    },
                },
            });

            table.addRows(
                ["foo", "bar", "baz"],
                ["frob", "bar", "quuz"],
            );

            const expected = ["╔══════╤═════╤══════╗", "║ foo  │ bar │ baz  ║", "╟──────┼─────┼──────╢", "║ frob │ bar │ quuz ║", "╚══════╧═════╧══════╝"].join(
                "\n",
            );

            expect(table.toString()).toBe(expected);
        });

        it("should support disabled decoration lines", () => {
            const table = new Table({
                style: {
                    border: NO_BORDER,
                    paddingLeft: 1,
                    paddingRight: 1,
                },
            });

            table.addRows(
                ["foo", "bar", "baz"],
                ["frobnicate", "bar", "quuz"],
            );

            expect(table.toString()).toMatchSnapshot();
        });
    });

    describe("cell alignment", () => {
        it("should support different cell alignments with borders", () => {
            expect.assertions(3);

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

            // Find the data line
            const dataLine = lines.find((line) => line.includes("1"))!;
            const cells = dataLine.split("│");

            // Verify alignments
            expect(cells[1].trimEnd()).toBe(" 1"); // Left aligned
            expect(cells[2].trim()).toBe("2"); // Center aligned
            expect(cells[3].trimStart()).toBe("3 "); // Right aligned
        });
    });

    describe("padding configuration", () => {
        it("should respect padding settings with borders", () => {
            expect.assertions(2);

            const table = new Table({
                style: {
                    paddingLeft: 2,
                    paddingRight: 2,
                },
            });

            table.addRow(["A", "B"]);

            const output = table.toString();
            const lines = output.split("\n");

            // Find the data line
            const dataLine = lines.find((line) => line.includes("A"))!;
            const cells = dataLine.split("│");

            // Verify padding
            expect(cells[1]).toBe("  A  "); // 2 spaces on each side
            expect(cells[2]).toBe("  B  "); // 2 spaces on each side
        });

        it("should handle zero padding", () => {
            const table = new Table({
                style: {
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });

            table.addRow(["A", "B"]);

            const expected = ["┌─┬─┐", "│A│B│", "└─┴─┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });
    });
});
