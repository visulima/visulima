import { describe, expect, it } from "vitest";

import { createTable } from "../src";
import { ASCII_BORDER, DEFAULT_BORDER, DOTS_BORDER, DOUBLE_BORDER, MARKDOWN_BORDER, MINIMAL_BORDER, NO_BORDER, ROUNDED_BORDER } from "../src/style";

describe("table Border Styles", () => {
    const sampleData = [
        ["Header 1", "Header 2", "Header 3"],
        ["Row 1 Cell 1", "Row 1 Cell 2", "Row 1 Cell 3"],
        ["Row 2 Cell 1", "Row 2 Cell 2", "Row 2 Cell 3"],
    ];

    // Use it.each to test all border styles
    it.each([
        ["DEFAULT", DEFAULT_BORDER],
        ["MINIMAL", MINIMAL_BORDER],
        ["DOUBLE", DOUBLE_BORDER],
        ["ROUNDED", ROUNDED_BORDER],
        ["DOTS", DOTS_BORDER],
        ["MARKDOWN", MARKDOWN_BORDER],
        ["ASCII", ASCII_BORDER],
        ["NO_BORDER", NO_BORDER],
    ])('renders table with %s border style', (name, borderStyle) => {
        expect.assertions(1);
        const table = createTable({
            style: {
                border: borderStyle,
            },
        });

        table.setHeaders(sampleData[0]);
        table.addRows(...sampleData.slice(1));

        const output = table.toString();
        expect(output).toMatchSnapshot();
    });

    // Test complex scenarios
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
        table.addRows(["Line 1\\nLine 2\\nLine 3", "Regular Cell"], ["Regular Cell 1", "Regular Cell 2"]);

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
            { content: "Top\\nAlign", vAlign: "top" },
            { content: "Middle\\nAlign", vAlign: "middle" },
            { content: "Bottom\\nAlign", vAlign: "bottom" },
        ]);
        table.addRows([
            { content: "Short", vAlign: "top" },
            { content: "Medium\\nText", vAlign: "middle" },
            { content: "Long\\nText\\nHere", vAlign: "bottom" },
        ]);

        const output = table.toString();
        expect(output).toMatchSnapshot();
    });

    it("renders table with word wrapping using MARKDOWN border style", () => {
        expect.assertions(1);
        const table = createTable({
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
            { content: "Left\\nTop", hAlign: "left", vAlign: "top" },
            { content: "Center\\nMiddle", hAlign: "center", vAlign: "middle" },
            { content: "Right\\nBottom", hAlign: "right", vAlign: "bottom" },
        ]);

        const output = table.toString();
        expect(output).toMatchSnapshot();
    });
});
