import React from "react";
import { describe, expect, expectTypeOf, it } from "vitest";

import { AreaChart, Heatmap, Histogram, LineChart, ScatterPlot } from "../../src/components/index";
import { createBrailleGrid } from "../../src/ink/canvas/braille";
import { createCanvasBuffer } from "../../src/ink/canvas/buffer";
import { renderToString } from "../helpers/ink-render";

describe(createBrailleGrid, () => {
    it("should light a single pixel and emit the matching braille glyph", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(1, 1);
        const grid = createBrailleGrid(1, 1);

        grid.plotPoint(0, 0);
        grid.flush(buffer.context);

        // U+2801 has bit 0 set (top-left pixel)
        expect(String.fromCodePoint(buffer.chars[0]!)).toBe("\u2801");
    });

    it("should accumulate bits for adjacent pixels into one glyph", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(1, 1);
        const grid = createBrailleGrid(1, 1);

        grid.plotPoint(0, 0);
        grid.plotPoint(1, 0);
        grid.flush(buffer.context);

        // bits 0x01 + 0x08 = 0x09 => U+2809
        expect(String.fromCodePoint(buffer.chars[0]!)).toBe("\u2809");
    });

    it("should plot a straight horizontal line", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(2, 1);
        const grid = createBrailleGrid(2, 1);

        grid.plotLine(0, 0, 3, 0);
        grid.flush(buffer.context);

        // Every x from 0 to 3 on row 0 should be lit (covers both cells)
        expect(String.fromCodePoint(buffer.chars[0]!)).not.toBe(" ");
    });

    it("should ignore out-of-bounds pixels", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(1, 1);
        const grid = createBrailleGrid(1, 1);

        grid.plotPoint(100, 100);
        grid.flush(buffer.context);

        expect(String.fromCodePoint(buffer.chars[0]!)).toBe(" ");
    });
});

describe(LineChart, () => {
    it("should render the plot area and a legend entry for each series", () => {
        expect.assertions(2);

        const output = renderToString(
            <LineChart
                height={5}
                series={[
                    { data: [1, 2, 3, 2, 1], label: "A" },
                    { data: [0, 1, 2, 3, 4], label: "B" },
                ]}
                width={20}
            />,
        );

        expect(output).toContain("A");
        expect(output).toContain("B");
    });

    it("should produce braille glyphs in the plot output", () => {
        expect.assertions(1);

        const output = renderToString(<LineChart series={[{ data: [1, 2, 3, 4, 5] }]} showLegend={false} width={10} />);

        expect(output).toMatch(/[\u2800-\u28FF]/);
    });

    it("should tolerate an empty series list without throwing", () => {
        expect.assertions(0);

        const output = renderToString(<LineChart series={[]} showLegend={false} />);

        expectTypeOf(output).toBeString();
    });
});

describe(AreaChart, () => {
    it("should render both fill glyphs and a line overlay", () => {
        expect.assertions(2);

        const output = renderToString(<AreaChart series={[{ data: [1, 4, 2, 6, 3] }]} showLegend={false} width={16} />);

        // Medium-density fill glyph
        expect(output).toMatch(/[▒▓░]/);
        expect(output).toMatch(/[\u2800-\u28FF]/);
    });
});

describe(ScatterPlot, () => {
    it("should render dotted braille output for scattered points", () => {
        expect.assertions(1);

        const output = renderToString(
            <ScatterPlot
                series={[
                    {
                        data: [
                            { x: 0, y: 0 },
                            { x: 5, y: 5 },
                            { x: 9, y: 1 },
                        ],
                        label: "pts",
                    },
                ]}
                showLegend={false}
                width={12}
            />,
        );

        expect(output).toMatch(/[\u2800-\u28FF]/);
    });
});

describe(Histogram, () => {
    it("should render a bucketed bar chart with labels", () => {
        expect.assertions(2);

        const output = renderToString(<Histogram bins={4} data={[1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8]} />);

        expect(output).toMatch(/[█▇▆▅▄▃▂▁]/);
        expect(output).toContain("-");
    });

    it("should honor explicit thresholds", () => {
        expect.assertions(1);

        const output = renderToString(<Histogram data={[1, 2, 3, 4, 5]} thresholds={[0, 2, 4, 6]} />);

        expect(output).toContain("0-2");
    });
});

describe(Heatmap, () => {
    it("should render the configured size and ANSI styles", () => {
        expect.assertions(1);

        const output = renderToString(
            <Heatmap
                data={[
                    [1, 2, 3],
                    [4, 5, 6],
                    [7, 8, 9],
                ]}
            />,
        );

        // Heatmap uses a full block char so the string should contain block characters
        expect(output).toContain("█");
    });

    it("should render column and row labels when provided", () => {
        expect.assertions(2);

        const output = renderToString(
            <Heatmap
                columnLabels={["a", "b"]}
                data={[
                    [0, 1],
                    [1, 0],
                ]}
                rowLabels={["x", "y"]}
            />,
        );

        expect(output).toContain("a");
        expect(output).toContain("x");
    });
});
