import { bgHex,blue, green, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { createTable, Table } from "../src";

describe("table Cell Content Handling", () => {
    describe("formatting (ANSI colors, Unicode, Newlines)", () => {
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
                    columnWidths: 9,
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

                const table = createTable({ truncate: true });
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
    });

    describe("truncation", () => {
        const baseOptions = { style: { paddingLeft: 0, paddingRight: 0 } };
        const testString = "This is a long string";
        const longTestString = "Hello world this is a test";

        describe("basic truncation positions", () => {
            it("should truncate at the end", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                table.addRow(["", "   ", { content: testString, truncate: { position: "end" } }]);

                expect(table.toString()).toContain("This…");
            });

            it("should truncate at the start", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                table.addRow(["", "   ", { content: testString, truncate: { position: "start" } }]);

                expect(table.toString()).toContain("…ring");
            });

            it("should truncate in the middle", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                table.addRow(["", "   ", { content: testString, truncate: { position: "middle" } }]);

                expect(table.toString()).toContain("Th…ng");
            });
        });

        describe("truncation options", () => {
            it("should use custom truncation character", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                table.addRow(["", "   ", { content: testString, truncate: { ellipsis: "+", position: "end" } }]);

                expect(table.toString()).toContain("This+");
            });

            it("should combine space and custom truncation character", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                table.addRow(["", "   ", { content: testString, truncate: { ellipsis: " >", position: "end" } }]);

                expect(table.toString()).toContain("Thi >");
            });
        });

        describe("prefer truncation on space", () => {
            it("should truncate at word boundary when preferTruncationOnSpace is true", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 15] });
                table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: true } }]);

                expect(table.toString()).toContain("Hello world…");
            });

            it("should truncate at exact length when preferTruncationOnSpace is false", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 15] });
                table.addRow(["", "   ", { content: longTestString, truncate: { position: "end", preferTruncationOnSpace: false } }]);

                expect(table.toString()).toContain("Hello world th…");
            });

            it("should combine all options", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 15] });
                table.addRow([
                    "",
                    "   ",
                    {
                        content: longTestString,
                        truncate: {
                            ellipsis: ">",
                            position: "end",
                            preferTruncationOnSpace: true,
                        },
                    },
                ]);
                const output = table.toString();

                expect(output).toContain("Hello world>");
            });

            it("should truncate at word boundary with short width when preferTruncationOnSpace is true", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 5] });
                // "This is a long string" -> "This…"
                table.addRow(["", "   ", { content: testString, truncate: { position: "end", preferTruncationOnSpace: true } }]);

                expect(table.toString()).toContain("This…");
            });
        });

        describe("global truncation and complex scenarios", () => {
            it("should truncate based on global truncate: true option", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 15], truncate: true });
                // No cell-specific truncate, should default to end truncation with default ellipsis
                table.addRow(["", "   ", longTestString]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌┬─────┬───────────────┐
                  ││     │Hello world th…│
                  └┴─────┴───────────────┘"
                `);
            });

            it("should truncate based on global truncate: string option", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 15], truncate: { ellipsis: "..." } });
                table.addRow(["", "   ", longTestString]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌┬─────┬───────────────┐
                  ││     │Hello world ...│
                  └┴─────┴───────────────┘"
                `);
            });

            it("should prioritize cell-specific truncate over global truncate", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [0, 5, 10], truncate: true });
                // Cell specific should override global true
                table.addRow(["", "   ", { content: longTestString, truncate: { ellipsis: "<-", position: "start" } }]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌┬─────┬──────────┐
                  ││     │<-s a test│
                  └┴─────┴──────────┘"
                `);
            });

            it("should handle multi-line content with truncation", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [15, 20, 10], truncate: "..." });
                table.addRow([
                    "Authentication",
                    "This is a very long description that needs truncation", // Will be truncated
                    "Active",
                ]);
                table.addRow([
                    "Authorization",
                    "Role-based\naccess control", // Multi-line, should not be truncated if fits
                    "Pending",
                ]);

                expect(table.toString()).toMatchSnapshot(); // Use snapshot for complex output
            });

            it("should handle empty and whitespace cells correctly in a truncated table", () => {
                expect.assertions(1);

                const table = createTable({ ...baseOptions, columnWidths: [5, 5, 15], truncate: true });
                table.addRow(["", "   ", longTestString]); // Whitespace cell, empty cell, truncated cell

                expect(table.toString()).toMatchSnapshot();
            });

            it("should apply global backgroundColor", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: { backgroundColor: { close: "\u001B[49m", open: "\u001B[41m" } }, // Red BG
                });
                table.addRow(["Cell A", "Cell B"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "[41m┌[49m[41m──────────[49m[41m┬[49m[41m──────────[49m[41m┐[49m
                  [41m│[49m[41m Cell A   [49m[41m│[49m[41m Cell B   [49m[41m│[49m
                  [41m└[49m[41m──────────[49m[41m┴[49m[41m──────────[49m[41m┘[49m"
                `);
            });

            it("should apply global foregroundColor", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: { foregroundColor: { close: "\u001B[39m", open: "\u001B[94m" } }, // Bright Blue FG
                });
                table.addRow(["Cell A", "Cell B"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌──────────┬──────────┐
                  [94m│[39m[94m Cell A   [39m[94m│[39m[94m Cell B   [39m[94m│[39m
                  └──────────┴──────────┘"
                `);
            });

            it("should apply both global colors", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: {
                        backgroundColor: { close: "\u001B[49m", open: "\u001B[41m" }, // Red BG
                        foregroundColor: { close: "\u001B[39m", open: "\u001B[94m" }, // Bright Blue FG
                    },
                });
                table.addRow(["Cell A", "Cell B"]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "[41m┌[49m[41m──────────[49m[41m┬[49m[41m──────────[49m[41m┐[49m
                  [41m[94m│[39m[49m[41m[94m Cell A   [39m[49m[41m[94m│[39m[49m[41m[94m Cell B   [39m[49m[41m[94m│[39m[49m
                  [41m└[49m[41m──────────[49m[41m┴[49m[41m──────────[49m[41m┘[49m"
                `);
            });

            it("should prioritize cell backgroundColor over global", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: { backgroundColor: { close: "\u001B[49m", open: "\u001B[41m" } }, // Red BG (Global)
                });
                table.addRow([
                    "Cell A",
                    { backgroundColor: { close: "\u001B[49m", open: "\u001B[42m" }, content: "Cell B" }, // Green BG (Cell)
                ]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "[41m┌[49m[41m──────────[49m[41m┬[49m[41m──────────[49m[41m┐[49m
                  [41m│[49m[41m Cell A   [49m[41m│[49m[42m Cell B   [49m[41m│[49m
                  [41m└[49m[41m──────────[49m[41m┴[49m[41m──────────[49m[41m┘[49m"
                `);
            });

            it("should prioritize cell foregroundColor over global", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: { foregroundColor: { close: "\u001B[39m", open: "\u001B[94m" } }, // Bright Blue FG (Global)
                });
                table.addRow([
                    "Cell A",
                    { content: "Cell B", foregroundColor: { close: "\u001B[39m", open: "\u001B[91m" } }, // Bright Red FG (Cell)
                ]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "┌──────────┬──────────┐
                  [94m│[39m[94m Cell A   [39m[94m│[39m[91m Cell B   [39m[94m│[39m
                  └──────────┴──────────┘"
                `);
            });

            it("should prioritize cell colors over both global colors", () => {
                expect.assertions(1);

                const table = createTable({
                    ...baseOptions,
                    columnWidths: [10, 10],
                    style: {
                        backgroundColor: { close: "\u001B[49m", open: "\u001B[41m" }, // Red BG (Global)
                        foregroundColor: { close: "\u001B[39m", open: "\u001B[94m" }, // Bright Blue FG (Global)
                    },
                });
                table.addRow([
                    "Cell A", // Should inherit global Red BG / Blue FG
                    {
                        backgroundColor: { close: "\u001B[49m", open: "\u001B[42m" }, // Green BG (Cell)
                        content: "Cell B",
                        foregroundColor: { close: "\u001B[39m", open: "\u001B[91m" }, // Bright Red FG (Cell)
                    },
                ]);

                expect(table.toString()).toMatchInlineSnapshot(`
                  "[41m┌[49m[41m──────────[49m[41m┬[49m[41m──────────[49m[41m┐[49m
                  [41m[94m│[39m[49m[41m[94m Cell A   [39m[49m[41m[94m│[39m[49m[42m[91m Cell B   [39m[49m[41m[94m│[39m[49m
                  [41m└[49m[41m──────────[49m[41m┴[49m[41m──────────[49m[41m┘[49m"
                `);
            });
        });
    });

    describe("empty and nullish content", () => {
        it("should render empty string, null, and undefined content correctly", () => {
            expect.assertions(1);

            const table = createTable();
            table.setHeaders(["EmptyStrH", null, undefined, "ContentH"]);
            table.addRow(["", null, { content: undefined }, "Content"]);
            table.addRow([" ", { content: "" }, "Explicit", "Stuff"]); // Space vs empty

            expect(table.toString()).toMatchInlineSnapshot(`
              "┌───────────┬──┬──────────┬──────────┐
              │ EmptyStrH │  │          │ ContentH │
              ├───────────┼──┼──────────┼──────────┤
              │           │  │          │ Content  │
              ├───────────┼──┼──────────┼──────────┤
              │           │  │ Explicit │ Stuff    │
              └───────────┴──┴──────────┴──────────┘"
            `);
        });
    });

    describe("hyperlinks (href)", () => {
        it("should wrap content with OSC 8 hyperlink sequences when href is provided", () => {
            expect.assertions(2);

            const table = createTable();
            const url = "https://example.com";
            const linkText = "Example";

            table.addRow([{ content: linkText, href: url }]);

            const expectedOutput = table.toString();

            // Check for the OSC 8 sequence start, the URL, the text, and the sequence end
            const osc8Start = `\u001B]8;;${url}\u001B\\`;
            const osc8End = `\u001B]8;;\u001B\\`;

            // Check that the full sequence is present
            expect(expectedOutput).toContain(`${osc8Start}${linkText}${osc8End}`);

            expect(expectedOutput).toMatchInlineSnapshot(`
              "┌─────────┐
              │ ]8;;https://example.com\\Example]8;;\\ │
              └─────────┘"
            `); // Snapshot will contain the escape codes
        });
    });

    describe("border colors", () => {
        it("should apply only borderColor when set", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    borderColor: red, // Red Border
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow(["Cell A", { content: "Cell B", foregroundColor: blue }]); // Blue FG on Cell B

            // Expect border to be red, Cell A default FG, Cell B blue FG
            expect(table.toString()).toMatchInlineSnapshot(`
              "[31m┌[39m[31m──────[39m[31m┬[39m[31m──────[39m[31m┐[39m
              [31m│[39mCell A[31m│[39m[34mCell B[39m[31m│[39m
              [31m└[39m[31m──────[39m[31m┴[39m[31m──────[39m[31m┘[39m"
            `);
        });

        it("should apply borderColor with global background and foreground colors", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    backgroundColor: { close: "\u001B[49m", open: "\u001B[44m" }, // Blue BG
                    borderColor: red, // Red Border
                    foregroundColor: { close: "\u001B[39m", open: "\u001B[97m" }, // White FG
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow([{ content: "spanning", rowSpan: 2 }, "regular"]).addRow(["second"]);

            // Expect border red, background blue, foreground white
            expect(table.toString()).toMatchInlineSnapshot(`
              "[44m[31m┌[39m[49m[44m[31m────────[39m[49m[44m[31m┬[39m[49m[44m[31m───────[39m[49m[44m[31m┐[39m[49m
              [44m[31m│[39m[49m[44m[97mspanning[39m[49m[44m[31m│[39m[49m[44m[97mregular[39m[49m[44m[31m│[39m[49m
              [44m[31m│[39m[49m[44m[31m        [39m[49m[44m[31m├[39m[49m[44m[31m───────[39m[49m[44m[31m┤[39m[49m
              [44m[31m│[39m[49m[44m[97m        [39m[49m[44m[31m│[39m[49m[44m[97msecond [39m[49m[44m[31m│[39m[49m
              [44m[31m└[39m[49m[44m[31m────────[39m[49m[44m[31m┴[39m[49m[44m[31m───────[39m[49m[44m[31m┘[39m[49m"
            `);
        });

        it("should apply borderColor with global colors, respecting cell foregroundColor", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    backgroundColor: { close: "\u001B[49m", open: "\u001B[44m" }, // Blue BG
                    borderColor: red, // Red Border
                    foregroundColor: { close: "\u001B[39m", open: "\u001B[97m" }, // White FG (Global)
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow(["Cell 1", { content: "Cell 2", foregroundColor: green }]); // Green FG (Cell)

            // Expect border red, BG blue, Cell 1 white FG, Cell 2 green FG
            expect(table.toString()).toMatchInlineSnapshot(`
              "[44m[31m┌[39m[49m[44m[31m──────[39m[49m[44m[31m┬[39m[49m[44m[31m──────[39m[49m[44m[31m┐[39m[49m
              [44m[31m│[39m[49m[44m[97mCell 1[39m[49m[44m[31m│[39m[49m[44m[32mCell 2[39m[49m[44m[31m│[39m[49m
              [44m[31m└[39m[49m[44m[31m──────[39m[49m[44m[31m┴[39m[49m[44m[31m──────[39m[49m[44m[31m┘[39m[49m"
            `);
        });

        it("should apply borderColor with rowSpan, background, and foreground colors", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    backgroundColor: bgHex("#3d239d"),
                    borderColor: red,
                    foregroundColor: blue,
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow([{ content: "spanning\ncell\nwith\nmore\nlines", rowSpan: 2 }, "regular"]).addRow(["second"]);

            // Expect border red, background blue, foreground blue, handles rowSpan
            expect(table.toString()).toMatchInlineSnapshot(`
              "[48;2;61;35;157m[31m┌[39m[49m[48;2;61;35;157m[31m────────[39m[49m[48;2;61;35;157m[31m┬[39m[49m[48;2;61;35;157m[31m───────[39m[49m[48;2;61;35;157m[31m┐[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mspanning[39m[49m[48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mregular[39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mcell    [39m[49m[48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34m       [39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mwith    [39m[49m[48;2;61;35;157m[31m├[39m[49m[48;2;61;35;157m[31m───────[39m[49m[48;2;61;35;157m[31m┤[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mmore    [39m[49m[48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34msecond [39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mlines   [39m[49m[48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34m       [39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m└[39m[49m[48;2;61;35;157m[31m────────[39m[49m[48;2;61;35;157m[31m┴[39m[49m[48;2;61;35;157m[31m───────[39m[49m[48;2;61;35;157m[31m┘[39m[49m"
            `);
        });

        it("should apply borderColor with global colors, cell foregroundColor override, and colSpan", () => {
            expect.assertions(1);

            const table = createTable({
                style: {
                    backgroundColor: bgHex("#3d239d"),
                    borderColor: red,
                    foregroundColor: blue,
                    paddingLeft: 0,
                    paddingRight: 0,
                },
            });
            table.addRow(["Cell 1"]);
            table.addRow(["Cell 2"]);
            table.addRow([{ colSpan: 2, content: "Cell 3", foregroundColor: green }]);

            // Expect border red, BG blue, Cell 1/2 blue FG, Cell 3 green FG (spanning 2 cols)
            expect(table.toString()).toMatchInlineSnapshot(`
              "[48;2;61;35;157m[31m┌[39m[49m[48;2;61;35;157m[31m──────[39m[49m[48;2;61;35;157m[31m┬[39m[49m[48;2;61;35;157m[31m──────[39m[49m[48;2;61;35;157m[31m┐[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mCell 1[39m[49m[48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[34mCell 2[39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m├[39m[49m[48;2;61;35;157m[31m──────[39m[49m[48;2;61;35;157m[31m┴[39m[49m[48;2;61;35;157m[31m──────[39m[49m[48;2;61;35;157m[31m┤[39m[49m
              [48;2;61;35;157m[31m│[39m[49m[48;2;61;35;157m[32mCell 3       [39m[49m[48;2;61;35;157m[31m│[39m[49m
              [48;2;61;35;157m[31m└[39m[49m[48;2;61;35;157m[31m─────────────[39m[49m[48;2;61;35;157m[31m┘[39m[49m"
            `);
        });
    });
});
