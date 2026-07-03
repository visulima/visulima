import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGrid, Grid } from "../src";
import { DEFAULT_BORDER, NO_BORDER } from "../src/style";

describe("grid core tests", () => {
    describe("grid options specific tests", () => {
        it("should use provided terminalWidth instead of calculating", () => {
            expect.assertions(1);

            const grid = createGrid({ columns: 2, terminalWidth: 10 });

            grid.addItem("VeryLongContent");
            grid.addItem("MoreLongContent");

            // Expect the output width to be constrained by terminalWidth (approx 10)
            // Exact output depends on border/padding minimums
            expect(grid.toString().split("\n")[0]?.length).toBeLessThanOrEqual(10 + 5); // Allow some buffer
        });

        it("should handle placeItems with empty items list", () => {
            expect.assertions(1);

            const grid = new Grid({ columns: 2 }); // Grid class directly

            // @ts-expect-error - Accessing private method for test
            grid.items = []; // Set items to empty

            expect(grid.toString()).toBe(""); // Expect empty output
        });
    });

    describe("width calculation tests", () => {
        it("should shrink columns when total width exceeds maxWidth, respecting minimum width 1", () => {
            expect.assertions(1);

            const grid = createGrid({ columns: 2, maxWidth: 20 });

            grid.addItem("VeryLongContent");
            grid.addItem("MoreLongContent");

            expect(grid.toString().split("\n")[0]?.length).toBeLessThanOrEqual(20 + 2); // Allow small buffer
        });

        it("should expand columns slightly if total width is less than maxWidth", () => {
            // This test logic might need refinement depending on exact expansion behavior
            expect.assertions(2);

            const grid = createGrid({ columns: 2, maxWidth: 20 });

            grid.addItem("abc");
            grid.addItem("def"); // Calculated width likely < 20

            const topBorderLength = grid.toString().split("\n")[0]?.length ?? 0;

            expect(topBorderLength).toBe(10);
            expect(topBorderLength).toBeLessThanOrEqual(20 + 2); // Should not exceed maxWidth significantly
        });
    });

    describe("autoFlow option", () => {
        it("should lay out items column by column when autoFlow is 'column'", () => {
            expect.assertions(1);

            // Create a grid with 2 columns and explicitly set rows to constrain layout
            const grid = new Grid({
                autoFlow: "column",
                border: DEFAULT_BORDER,
                columns: 6,
            });

            // Add items
            grid.addItem("A");
            grid.addItem("B");
            grid.addItem("C");
            grid.addItem("D");
            grid.addItem("E");
            grid.addItem("F");

            expect(grid.toString()).toMatchInlineSnapshot(`
                "┌───┬───┬───┬───┬───┬───┐
                │ A │ B │ C │ D │ E │ F │
                └───┴───┴───┴───┴───┴───┘"
            `);
        });
    });

    describe("setter methods", () => {
        it("should update columns using setColumns", () => {
            expect.assertions(1);

            const grid = new Grid({ border: DEFAULT_BORDER, columns: 2 });

            grid.addItem("A");
            grid.addItem("B");
            grid.addItem("C");
            grid.addItem("D");
            grid.setColumns(1); // Change to 1 column

            expect(grid.toString()).toMatchInlineSnapshot(`
                "┌───┐
                │ A │
                ├───┤
                │ B │
                ├───┤
                │ C │
                ├───┤
                │ D │
                └───┘"
            `);
        });

        // Note: Testing setRows effect might be less direct as it primarily affects internal layout calculations
        // unless combined with other features like autoFlow.
        it("should update rows using setRows (effect may be subtle)", () => {
            expect.assertions(2);

            const grid = new Grid({ columns: 2, rows: 1 });

            grid.addItem("A");
            grid.addItem("B");

            const initialOutput = grid.toString();

            grid.setRows(2);
            grid.addItem("C"); // Add item after increasing rows

            // Expecting a different layout, potentially allowing C to be placed
            expect(grid.toString()).not.toBe(initialOutput);
            // More specific assertion depends on exact layout logic
            expect(grid.toString()).toContain("C");
        });

        it("should update border style using setBorder", () => {
            expect.assertions(2);

            const grid = new Grid({ border: DEFAULT_BORDER, columns: 1 });

            grid.addItem("Test");
            const defaultBorderOutput = grid.toString();

            grid.setBorder(NO_BORDER);
            const noBorderOutput = grid.toString();

            expect(defaultBorderOutput).toContain("┌");
            expect(noBorderOutput).not.toContain("┌");
        });

        it("should update border visibility using setShowBorders", () => {
            expect.assertions(2);

            const grid = new Grid({ border: DEFAULT_BORDER, columns: 1 });

            grid.addItem("Test");

            const bordersShownOutput = grid.toString();

            grid.setShowBorders(false);

            const bordersHiddenOutput = grid.toString();

            expect(bordersShownOutput).toContain("┌");
            expect(bordersHiddenOutput).not.toContain("┌");
        });

        it("should update maximum width using setMaxWidth", () => {
            expect.assertions(2);

            const grid = new Grid({ columns: 1 });

            grid.addItem("Long Content Item");
            const initialOutput = grid.toString();

            grid.setMaxWidth(10);
            const constrainedOutput = grid.toString();

            const initialWidth = initialOutput.split("\n")[0]?.length ?? 0;
            const constrainedWidth = constrainedOutput.split("\n")[0]?.length ?? 0;

            expect(constrainedWidth).toBeLessThan(initialWidth);
            expect(constrainedWidth).toBeLessThanOrEqual(10 + 5); // Allow buffer
        });
    });

    it("should handle setting border to null/undefined after construction", () => {
        expect.assertions(1);

        const grid = createGrid({ columns: 2 });

        grid.addItem("A");
        grid.addItem("B");

        grid.setBorder(NO_BORDER);

        expect(grid.toString()).toMatchInlineSnapshot(`" A  B "`);
    });

    describe("item placement failures", () => {
        let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            // Mock console.warn before each test in this block
            consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        });

        afterEach(() => {
            // Restore mock after each test
            consoleWarnSpy.mockRestore();
        });

        it("should warn when an item cannot be placed (grid full, autoFlow: row)", () => {
            expect.assertions(2);

            const grid = new Grid({ columns: 1, rows: 1 }); // Very small grid

            grid.addItem("A"); // Fill the grid

            // Attempt to add another item
            grid.addItem("B");

            // Render to trigger placement logic
            grid.toString();

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Could not find position for item"));
        });

        it("should warn when an item cannot be placed (grid full, autoFlow: column)", () => {
            expect.assertions(2);

            const grid = new Grid({ autoFlow: "column", columns: 1, rows: 1 });

            grid.addItem("A");
            grid.addItem("B"); // Attempt to add second item
            grid.toString();

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Could not find position for item"));
        });

        it("should warn when an item cannot be placed due to existing spans", () => {
            expect.assertions(2);

            const grid = new Grid({ columns: 2, rows: 1 });

            grid.addItem({ colSpan: 2, content: "Span" }); // Item spans the whole row
            grid.addItem("Cannot Fit"); // This item has no place to go
            grid.toString();

            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Could not find position for item"));
        });
    });
});
