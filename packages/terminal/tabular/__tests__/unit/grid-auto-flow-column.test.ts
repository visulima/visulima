import { describe, expect, it, vi } from "vitest";

import type { GridItem, GridOptions } from "../../src";
import { createGrid } from "../../src";
import { DEFAULT_BORDER } from "../../src/style";

type ColumnGridResult = {
    onWarn: ReturnType<typeof vi.fn>;
    output: string;
};

/**
 * Builds a column-flow grid, adds every item and renders it, capturing any
 * placement diagnostics through `onWarn` instead of letting them reach stderr.
 * @param items The cells to add, in source order.
 * @param options Extra grid options merged over the column-flow defaults.
 * @returns The rendered grid plus the diagnostic spy.
 */
const renderColumnGrid = (items: (GridItem | string | null)[], options: Partial<GridOptions> = {}): ColumnGridResult => {
    const onWarn = vi.fn<(message: string) => void>();

    const grid = createGrid({
        autoFlow: "column",
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

describe("grid column auto-flow", () => {
    it("fills the first column top to bottom before starting the next one", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4"], { border: DEFAULT_BORDER });

        expect(output).toBe(["┌───┬───┐", "│ 1 │ 3 │", "├───┼───┤", "│ 2 │ 4 │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("places every item when the count does not divide evenly by the column height", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4", "5"], { border: DEFAULT_BORDER });

        // Five items over two columns need a three-row column: 1..3 fill the first
        // column, 4..5 the second, leaving one trailing hole.
        expect(output).toBe(["┌───┬───┐", "│ 1 │ 4 │", "├───┼───┤", "│ 2 │ 5 │", "├───┼───┤", "│ 3 │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("renders a single item without warning", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["only"], { columns: 3 });

        expect(output).toBe(" only     ");
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("stacks every item in a single-column grid", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["a", "b", "c"], { border: DEFAULT_BORDER, columns: 1 });

        expect(output).toBe(["┌───┐", "│ a │", "├───┤", "│ b │", "├───┤", "│ c │", "└───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("spreads items across one row when rows is 1", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["a", "b", "c"], { border: DEFAULT_BORDER, columns: 3, rows: 1 });

        expect(output).toBe(["┌───┬───┬───┐", "│ a │ b │ c │", "└───┴───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("uses an explicit rows option as the column height", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4", "5", "6"], { border: DEFAULT_BORDER, rows: 3 });

        expect(output).toBe(["┌───┬───┐", "│ 1 │ 4 │", "├───┼───┤", "│ 2 │ 5 │", "├───┼───┤", "│ 3 │ 6 │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("fills a wider grid column by column", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], {
            border: DEFAULT_BORDER,
            columns: 4,
        });

        expect(output).toBe(
            [
                "┌───┬───┬───┬────┐",
                "│ 1 │ 4 │ 7 │ 10 │",
                "├───┼───┼───┼────┤",
                "│ 2 │ 5 │ 8 │ 11 │",
                "├───┼───┼───┼────┤",
                "│ 3 │ 6 │ 9 │ 12 │",
                "└───┴───┴───┴────┘",
            ].join("\n"),
        );
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("keeps the gap between columns", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4"], { gap: 2 });

        expect(output).toBe([" 1      3 ", " 2      4 "].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("honours fixed column widths", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4"], { border: DEFAULT_BORDER, fixedColumnWidths: [8, 5] });

        expect(output).toBe(["┌────────┬─────┐", "│ 1      │ 3   │", "├────────┼─────┤", "│ 2      │ 4   │", "└────────┴─────┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("flows around a column-spanning item", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid([{ colSpan: 2, content: "wide" }, "a", "b", "c"], { border: DEFAULT_BORDER });

        // "wide" takes the whole first row, so the column cursor continues below it
        // and the second column resumes under the span.
        expect(output).toBe(["┌───────┐", "│ wide  │", "├───┬───┤", "│ a │ c │", "├───┼───┤", "│ b │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("flows around a row-spanning item", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid([{ content: "tall", rowSpan: 2 }, "a", "b", "c"], { border: DEFAULT_BORDER });

        expect(output).toBe(["┌──────┬───┐", "│ tall │ b │", "│      ├───┤", "│      │ c │", "├──────┼───┤", "│ a    │   │", "└──────┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("places every item when all of them span two rows", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(
            [
                { content: "A", rowSpan: 2 },
                { content: "B", rowSpan: 2 },
                { content: "C", rowSpan: 2 },
                { content: "D", rowSpan: 2 },
            ],
            { border: DEFAULT_BORDER },
        );

        expect(output).toBe(["┌───┬───┐", "│ A │ C │", "│   │   │", "├───┼───┤", "│ B │ D │", "│   │   │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("lets an empty cell consume its slot in the column", () => {
        expect.assertions(2);

        const { onWarn, output } = renderColumnGrid(["a", null, "c", "d"], { border: DEFAULT_BORDER });

        expect(output).toBe(["┌───┬───┐", "│ a │ c │", "├───┼───┤", "│   │ d │", "└───┴───┘"].join("\n"));
        expect(onWarn).not.toHaveBeenCalled();
    });

    it("still warns for the one item that does not fit a fully sized grid", () => {
        expect.assertions(3);

        const { onWarn, output } = renderColumnGrid(["1", "2", "3", "4", "5"], { border: DEFAULT_BORDER, rows: 2 });

        expect(output).toBe(["┌───┬───┐", "│ 1 │ 3 │", "├───┼───┤", "│ 2 │ 4 │", "└───┴───┘"].join("\n"));
        expect(onWarn).toHaveBeenCalledTimes(1);
        expect(onWarn).toHaveBeenCalledWith(expect.stringContaining("Could not find position for item"));
    });

    it("reports every unplaceable item instead of dropping the rest silently", () => {
        expect.assertions(2);

        // A one-cell grid can only hold the first item; the two that follow must each
        // be reported rather than being swallowed by an early exit.
        const { onWarn, output } = renderColumnGrid(["1", "2", "3"], { columns: 1, rows: 1 });

        expect(output).toBe(" 1 ");
        expect(onWarn).toHaveBeenCalledTimes(2);
    });
});
