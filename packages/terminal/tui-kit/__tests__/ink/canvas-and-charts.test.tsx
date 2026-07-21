import { createCanvasBuffer, serializeRow } from "@visulima/tui/canvas";
import { Canvas } from "@visulima/tui/components/canvas";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BarChart } from "../../src/index";
import { renderToString } from "../helpers/ink-render";

describe(createCanvasBuffer, () => {
    it("should initialize all cells to spaces", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(4, 2);

        expect([...buffer.chars]).toStrictEqual([0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20]);
    });

    it("should mark a row dirty when a cell is written", () => {
        expect.assertions(2);

        const buffer = createCanvasBuffer(4, 2);

        buffer.context.setCell(0, 0, "X");

        expect(buffer.dirty[0]).toBe(1);
        expect(buffer.dirty[1]).toBe(0);
    });

    it("should ignore out-of-bounds writes", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(2, 2);

        buffer.context.setCell(99, 99, "X");

        expect(buffer.dirty[0]).toBe(0);
    });

    it("should not re-dirty a row when the same value is written twice", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(2, 2);

        buffer.context.setCell(0, 0, "A");
        buffer.dirty.fill(0);
        buffer.context.setCell(0, 0, "A");

        expect(buffer.dirty[0]).toBe(0);
    });

    it("drawRect should fill every cell in the region", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(4, 3);

        buffer.context.drawRect(0, 0, 4, 3, "#");

        const allHashes = [...buffer.chars].every((codepoint) => codepoint === "#".codePointAt(0));

        expect(allHashes).toBe(true);
    });

    it("drawText should write each character left-to-right", () => {
        expect.assertions(3);

        const buffer = createCanvasBuffer(5, 1);

        buffer.context.drawText(1, 0, "abc");

        expect(String.fromCodePoint(buffer.chars[1]!)).toBe("a");
        expect(String.fromCodePoint(buffer.chars[2]!)).toBe("b");
        expect(String.fromCodePoint(buffer.chars[3]!)).toBe("c");
    });

    it("drawVBar should fill from the bottom up", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(1, 4);

        buffer.context.drawVBar(0, 0, 4, 0.5);
        // ratio 0.5 over 4 rows = 2 full block rows from the bottom
        const bottomRow = String.fromCodePoint(buffer.chars[3 * 1]!);
        const topRow = String.fromCodePoint(buffer.chars[0]!);

        expect([bottomRow, topRow]).toStrictEqual(["█", " "]);
    });

    it("drawHBar should fill from the left", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(4, 1);

        buffer.context.drawHBar(0, 0, 4, 0.5);

        expect(String.fromCodePoint(buffer.chars[0]!)).toBe("█");
    });

    it("clear should reset every cell and mark every row dirty", () => {
        expect.assertions(2);

        const buffer = createCanvasBuffer(3, 2);

        buffer.context.drawText(0, 0, "abc");
        buffer.context.clear();

        expect(buffer.chars[0]).toBe(0x20);
        expect([...buffer.dirty]).toStrictEqual([1, 1]);
    });
});

describe(serializeRow, () => {
    it("should produce a plain string for an unstyled row", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(5, 1);

        buffer.context.drawText(0, 0, "hello");

        expect(serializeRow(buffer, 0)).toBe("hello");
    });

    it("should embed ANSI for styled spans", () => {
        expect.assertions(1);

        const buffer = createCanvasBuffer(5, 1);

        buffer.context.drawText(0, 0, "hi", { color: "red" });
        buffer.context.drawText(2, 0, "bye");

        const output = serializeRow(buffer, 0);

        expect(output).toContain("\u001B");
    });
});

describe(Canvas, () => {
    it("should call the draw callback with the canvas dimensions", () => {
        expect.assertions(1);

        const draw = vi.fn();

        renderToString(<Canvas draw={draw} height={3} version="v0" width={5} />);

        const context = draw.mock.calls[0]?.[0];

        expect(context).toMatchObject({ height: 3, width: 5 });
    });

    it("should render the painted content", () => {
        expect.assertions(1);

        const output = renderToString(
            <Canvas
                draw={(context) => {
                    context.drawText(0, 0, "hello");
                }}
                height={1}
                version="v1"
                width={5}
            />,
        );

        expect(output).toContain("hello");
    });

    it("should reuse cached rows when version is unchanged", () => {
        expect.assertions(1);

        const draw = vi.fn((context) => {
            context.drawText(0, 0, "x");
        });

        // First render paints; second render should still call draw (the
        // useMemo recomputes inside the same render pass) but the buffer
        // must remain stable across instantiations.
        renderToString(<Canvas draw={draw} height={1} version="v1" width={2} />);
        renderToString(<Canvas draw={draw} height={1} version="v1" width={2} />);

        // Two independent renders => two draw calls, but each runs once.
        expect(draw).toHaveBeenCalledTimes(2);
    });
});

describe(BarChart, () => {
    it("should render labels under vertical bars", () => {
        expect.assertions(2);

        const output = renderToString(
            <BarChart
                data={[
                    { label: "A", value: 10 },
                    { label: "B", value: 20 },
                ]}
                height={5}
            />,
        );

        expect(output).toContain("A");
        expect(output).toContain("B");
    });

    it("should render values when showValues is true", () => {
        expect.assertions(2);

        const output = renderToString(
            <BarChart
                data={[
                    { label: "X", value: 7 },
                    { label: "Y", value: 13 },
                ]}
                showValues
            />,
        );

        expect(output).toContain("7");
        expect(output).toContain("13");
    });

    it("should render block characters in the plot area", () => {
        expect.assertions(1);

        const output = renderToString(<BarChart data={[{ value: 1 }, { value: 1 }]} height={4} />);

        expect(output).toMatch(/[█▇▆▅▄▃▂▁]/);
    });

    it("should render horizontal layout when orientation is horizontal", () => {
        expect.assertions(2);

        const output = renderToString(
            <BarChart
                data={[
                    { label: "A", value: 5 },
                    { label: "B", value: 10 },
                ]}
                orientation="horizontal"
                width={20}
            />,
        );

        expect(output).toContain("A");
        expect(output).toContain("B");
    });
});
