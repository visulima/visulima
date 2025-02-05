import { describe, expect, it } from "vitest";

import type { Cell as CellType } from "../../../src/types";
import { fillRowToWidth } from "../../../src/utils/fill-row-to-width";

describe("fillRowToWidth", () => {
    it("should not modify row if current width equals target width", () => {
        expect.assertions(1);

        const row: CellType[] = ["cell1", "cell2", "cell3"];
        const result = fillRowToWidth(row, 3);
        expect(result).toEqual(row);
    });

    it("should not modify row if current width exceeds target width", () => {
        expect.assertions(1);

        const row: CellType[] = ["cell1", "cell2", "cell3"];
        const result = fillRowToWidth(row, 2);
        expect(result).toEqual(row);
    });

    it("should pad row with null cells to reach target width", () => {
        expect.assertions(1);

        const row: CellType[] = ["cell1", "cell2"];
        const result = fillRowToWidth(row, 4);
        expect(result).toEqual(["cell1", "cell2", null, null]);
    });

    it("should handle empty row", () => {
        expect.assertions(1);

        const result = fillRowToWidth([], 3);
        expect(result).toEqual([null, null, null]);
    });

    it("should handle row with object cells and colSpan", () => {
        expect.assertions(1);

        const row: CellType[] = [{ colSpan: 2, content: "wide cell" }];
        const result = fillRowToWidth(row, 4);
        expect(result).toEqual([{ colSpan: 2, content: "wide cell" }, null, null]);
    });

    it("should handle mixed row types", () => {
        expect.assertions(1);

        const row: CellType[] = [null, "string cell", { colSpan: 2, content: "wide cell" }];
        const result = fillRowToWidth(row, 6);
        expect(result).toEqual([null, "string cell", { colSpan: 2, content: "wide cell" }, null, null]);
    });
});
