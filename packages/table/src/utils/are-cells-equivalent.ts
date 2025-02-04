import type { LayoutCell } from "../types";
import { getRealCell } from "./get-real-cell";

/** Checks whether two layout cells represent the same originating cell. */
export const areCellsEquivalent = (cell1: LayoutCell | null, cell2: LayoutCell | null): boolean => {
    const realCell1 = getRealCell(cell1);
    const realCell2 = getRealCell(cell2);

    return realCell1 === realCell2;
};
