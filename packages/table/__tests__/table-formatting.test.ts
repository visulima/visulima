import { blue,red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { createTable,Table } from "../src";

describe("table formatting", () => {
    describe("aNSI colored text", () => {
        it("should maintain correct padding with ANSI colored text", () => {
            expect.assertions(3);

            const table = new Table();
            const coloredText = "\u001B[32m✓ Passed\u001B[0m";
            const warningText = "\u001B[33m⚠ Warning\u001B[0m";

            table.setHeaders(["Status", "Value"]).addRow([coloredText, "100"]).addRow([warningText, "50"]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify structure
            expect(lines).toStrictEqual(
                expect.arrayContaining([
                    expect.stringContaining("Status"),
                    expect.stringContaining("Value"),
                    expect.stringContaining("✓"),
                    expect.stringContaining("⚠"),
                ]),
            );

            // Verify colored text is preserved
            expect(output).toContain("\u001B[32m");
            expect(output).toContain("\u001B[33m");
        });

        it("should handle word wrapping with colored text", () => {
            expect.assertions(1);

            const table = createTable({
                wordWrap: true,
            });

            table.addRow([red("Hello how are you?"), blue("I am fine thanks!")]);

            expect(table.toString()).toMatchSnapshot();
        });
    });

    describe("unicode and CJK text", () => {
        it("should handle Unicode characters and emojis correctly", () => {
            expect.assertions(1);

            const table = new Table();

            table.setHeaders(["📊 Metrics", "Value"]).addRow(["代码覆盖率", "80%"]).addRow(["性能测试", "95%"]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify content
            expect(lines).toStrictEqual(
                expect.arrayContaining([
                    expect.stringContaining("📊"),
                    expect.stringContaining("代码覆盖率"),
                    expect.stringContaining("性能测试"),
                    expect.stringContaining("80%"),
                    expect.stringContaining("95%"),
                ]),
            );
        });

        it("should handle CJK text with truncation", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRows(
                ["foobar", { content: "English test", maxWidth: 9 }, "baz"],
                ["foobar", { content: "中文测试", maxWidth: 9 }, "baz"],
                ["foobar", { content: "日本語テスト", maxWidth: 9 }, "baz"],
                ["foobar", { content: "한국어테스트", maxWidth: 9 }, "baz"],
            );

            expect(table.toString()).toMatchSnapshot();
        });
    });

    describe("newlines", () => {
        it("should handle newlines in headers", () => {
            expect.assertions(1);

            const table = createTable();

            table.setHeaders(["Test", "1\n2\n3"]);

            const expected = ["┌──────┬───┐", "│ Test │ 1 │", "│      │ 2 │", "│      │ 3 │", "└──────┴───┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should handle newlines in body cells", () => {
            expect.assertions(1);

            const table = createTable();

            table.addRow(["something\nwith\nnewlines"]);

            const expected = ["┌───────────┐", "│ something │", "│ with      │", "│ newlines  │", "└───────────┘"].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should handle newlines in cross table header and body", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });

            table.setHeaders(["", "Header\n1"]);
            table.addRow(["Header\n2", "Testing\nsomething\ncool"]);

            const expected = [
                "┌──────┬─────────┐",
                "│      │Header   │",
                "│      │1        │",
                "├──────┼─────────┤",
                "│Header│Testing  │",
                "│2     │something│",
                "│      │cool     │",
                "└──────┴─────────┘",
            ].join("\n");

            expect(table.toString()).toBe(expected);
        });

        it("should maintain accurate column width with newlines", () => {
            expect.assertions(1);

            const table = createTable();

            table.setHeaders(["Test\nWidth"]);

            // Compute the total width including borders and padding
            const width = table.toString().split("\n")[0].length;
            expect(width).toBe(9);
        });
    });

    describe("truncation and multi-line text", () => {
        it("should truncate long text and handle multi-line content", () => {
            expect.assertions(3);

            const table = new Table();
            const longText = "This is a very long text that should be truncated";
            const multiLineText = "First line\nSecond line\nThird line";

            table.addRow([{ content: longText, maxWidth: 20 }]).addRow([{ content: multiLineText }]);

            const output = table.toString();
            const lines = output.split("\n");

            // Verify truncation
            const truncatedLine = lines.find((line) => line.includes("This"));

            expect(truncatedLine).toBe("│ This is a very long… │");
            expect((truncatedLine as string).length).toBeLessThanOrEqual(24); // 20 + padding + borders

            // Verify multi-line
            expect(lines).toStrictEqual(
                expect.arrayContaining([expect.stringContaining("First line"), expect.stringContaining("Second line"), expect.stringContaining("Third line")]),
            );
        });

        it("should properly truncate colored text", () => {
            expect.assertions(6);

            const table = new Table();
            const coloredText = "\u001B[32mThis is a very long green text that should be truncated\u001B[0m";

            table.addRow([{ content: coloredText, maxWidth: 20 }]);

            const output = table.toString();
            const lines = output.split("\n");

            // Find the line containing the colored text (including ANSI codes)
            const truncatedLine = lines.find((line) => line.includes("\u001B[32m"));
            expect(truncatedLine).toBeDefined();

            // Verify the line contains both start and end color codes
            expect(truncatedLine).toContain("\u001B[32m");
            expect(truncatedLine).toContain("\u001B[0m");

            // Strip ANSI codes and verify length
            const strippedLine = (truncatedLine as string).replaceAll(/\u001B\[\d+m/g, "");
            expect(strippedLine.length).toBeLessThanOrEqual(24); // 20 + padding + borders

            // Verify truncation indicator
            expect(strippedLine).toContain("…");

            // Verify color codes are properly closed and reopened around the truncation
            expect(truncatedLine).toMatch(/\u001B\[32m.*\u001B\[0m/);
        });
    });
});
