import { describe, expect, it, vi } from "vitest";

import type { GridItem, GridOptions } from "../../src";
import { createGrid } from "../../src";
import { DEFAULT_BORDER } from "../../src/style";

type ExplicitRowsResult = {
    onWarn: ReturnType<typeof vi.fn>;
    output: string;
};

/**
 * Builds a grid, adds every item and renders it, capturing any placement
 * diagnostics through `onWarn` instead of letting them reach stderr.
 * @param items The cells to add, in source order.
 * @param options Extra grid options merged over the two-column defaults.
 * @returns The rendered grid plus the diagnostic spy.
 */
const renderGrid = (items: (GridItem | string | null)[], options: Partial<GridOptions> = {}): ExplicitRowsResult => {
    const onWarn = vi.fn<(message: string) => void>();

    const grid = createGrid({
        columns: 2,
        onWarn,
        terminalWidth: 80,
        ...options,
    });

    for (const item of items) {
        grid.addItem(item);
    }

    return { onWarn, output: grid.toString() };
};

describe("grid explicit rows", () => {
    it("pads a row-flow grid out to the requested row count", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["a", "b"], { border: DEFAULT_BORDER, rows: 2 });

        // Two items fill one row; the explicit count materialises the second.
        expect(output).toBe(["┌───┬───┐", "│ a │ b │", "├───┼───┤", "│   │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("pads a column-flow grid out to the requested row count", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["1", "2", "3"], {
            autoFlow: "column",
            border: DEFAULT_BORDER,
            fixedColumnWidths: [3, 3],
            rows: 4,
        });

        expect(output).toBe(["┌───┬───┐", "│ 1 │   │", "├───┼───┤", "│ 2 │   │", "├───┼───┤", "│ 3 │   │", "├───┼───┤", "│   │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("pads a borderless grid with blank rows", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["a", "b"], { rows: 3 });

        expect(output).toBe([" a  b ", "      ", "      "].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("renders more than one padded row as a single tall empty band", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["a", "b"], { border: DEFAULT_BORDER, rows: 3 });

        // Vertically adjacent holes are not separated by a middle border, so the two
        // padded rows read as one two-line empty band. The grid is still three rows
        // tall; only the separator between the two holes is elided.
        expect(output).toBe(["┌───┬───┐", "│ a │ b │", "├───┼───┤", "│   │   │", "│   │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("does not pad a grid that holds no items at all", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid([], { border: DEFAULT_BORDER, rows: 3 });

        expect(output).toBe("");
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("leaves a fully filled grid untouched", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["a", "b", "c", "d"], { border: DEFAULT_BORDER, rows: 2 });

        expect(output).toBe(["┌───┬───┐", "│ a │ b │", "├───┼───┤", "│ c │ d │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("keeps trimming trailing empty rows when the row count is dynamic", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid(["a", "b"], { border: DEFAULT_BORDER, rows: 0 });

        expect(output).toBe(["┌───┬───┐", "│ a │ b │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("does not grow past the requested row count for items that do not fit", () => {
        expect.assertions(3);

        const { onWarn, output } = renderGrid(["a", "b", "c"], { border: DEFAULT_BORDER, rows: 1 });

        expect(output).toBe(["┌───┬───┐", "│ a │ b │", "└───┴───┘"].join("\n"));
        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("Could not find position for item"));
    });

    it("only ever grows, so a row-spanning item may exceed the requested count", () => {
        expect.assertions(2);

        const { onWarn, output } = renderGrid([{ content: "tall", rowSpan: 3 }], {
            border: DEFAULT_BORDER,
            fixedColumnWidths: [6, 3],
            rows: 2,
        });

        // The span is placed in full rather than being clipped to two rows.
        expect(output).toBe(["┌──────┬───┐", "│ tall │   │", "│      │   │", "│      │   │", "└──────┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("re-renders with the new row count after setRows", () => {
        expect.assertions(2);

        const onWarn = vi.fn<(message: string) => void>();
        const grid = createGrid({ border: DEFAULT_BORDER, columns: 2, onWarn, rows: 2, terminalWidth: 80 });

        grid.addItem("a");
        grid.addItem("b");

        expect(grid.toString()).toBe(["┌───┬───┐", "│ a │ b │", "├───┼───┤", "│   │   │", "└───┴───┘"].join("\n"));

        grid.setRows(0);

        expect(grid.toString()).toBe(["┌───┬───┐", "│ a │ b │", "└───┴───┘"].join("\n"));
    });
});
