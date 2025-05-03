import { describe, expect, it } from "vitest";

import { createGrid, Grid } from "../src";
import { NO_BORDER } from "../src/style";

describe("grid", () => {
    describe("grid options specific tests", () => {
        it("should use provided terminalWidth instead of calculating", () => {
            expect.assertions(1);
            // Mock getTerminalWidth temporarily if possible, or rely on behavior
            // Here, we create a wide grid but provide a small terminalWidth
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

    it("should handle setting border to null/undefined after construction", () => {
        expect.assertions(1);

        const grid = createGrid({ columns: 2 });

        grid.addItem("A");
        grid.addItem("B");

        grid.setBorder(NO_BORDER);

        expect(grid.toString()).toMatchInlineSnapshot(`" A  B "`);
    });
});
