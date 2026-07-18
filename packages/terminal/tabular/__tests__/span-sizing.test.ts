import { describe, expect, it } from "vitest";

import { createTable } from "../src";
import { NO_BORDER } from "../src/style";

describe("colSpan width distribution", () => {
    it("applies a trailing cell width to the column it occupies, not the middle of a preceding span", () => {
        expect.assertions(2);

        const table = createTable({
            columnWidths: [8, 8, 8],
            style: { paddingLeft: 0, paddingRight: 0 },
        });

        table.addRow([{ colSpan: 2, content: "AB" }, { content: "C", width: 3 }]);

        const output = table.toString();
        const bottom = output.split("\n").at(-1) as string;

        // The third (last) logical column must be exactly 3 wide.
        expect(bottom).toContain("┴───┘");
        // It must NOT have kept the original width of 8.
        expect(bottom).not.toContain("┴────────┘");
    });

    it("renders the full spanning content when balanced columns have very unequal minimums", () => {
        expect.assertions(1);

        const table = createTable({
            balancedWidths: true,
            style: { paddingLeft: 0, paddingRight: 0 },
            terminalWidth: 40,
        });

        // Column 0 gets a large minimum from a long unbreakable word, column 1 stays tiny.
        table.addRow(["Supercalifragilistic", "x"]);
        table.addRow([{ colSpan: 2, content: "SpanTwelve!!" }]);

        const output = table.toString();

        expect(output).toContain("SpanTwelve!!");
    });

    it("renders a cell at its exact width even when no columnWidths option is set", () => {
        expect.assertions(1);

        const table = createTable({
            style: { paddingLeft: 0, paddingRight: 0 },
        });

        table.addRow([{ content: "x", width: 10 }, "yy"]);

        const bottom = table.toString().split("\n").at(-1) as string;

        // First column must be exactly 10 wide.
        expect(bottom).toContain("└──────────┴");
    });
});

describe("borderless span alignment", () => {
    it("keeps a colSpan row the same width as the surrounding non-spanning rows", () => {
        expect.assertions(1);

        const table = createTable({
            style: { border: NO_BORDER, paddingLeft: 1, paddingRight: 1 },
        });

        table.addRow([{ colSpan: 2, content: "Spanning" }]);
        table.addRow(["aa", "bb"]);

        const lineWidths = new Set(table.toString().split("\n").map((line) => line.length));

        expect(lineWidths.size).toBe(1);
    });

    it("keeps every content line of a multi-line rowSpan cell", () => {
        expect.assertions(3);

        const table = createTable({
            style: { border: NO_BORDER, paddingLeft: 1, paddingRight: 1 },
        });

        table.addRow([{ content: "L1\nL2\nL3", rowSpan: 2 }, "a"]);
        table.addRow(["b"]);

        const output = table.toString();

        expect(output).toContain("L1");
        expect(output).toContain("L2");
        expect(output).toContain("L3");
    });
});
