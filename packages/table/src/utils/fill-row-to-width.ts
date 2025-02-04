import type { Cell as CellType } from "../types";
import { computeRowLogicalWidth } from "./compute-row-logical-width";

/** Pads a row with null cells so that its logical width equals targetWidth. */
export const fillRowToWidth = (row: CellType[], targetWidth: number): CellType[] => {
    const currentWidth = computeRowLogicalWidth(row);

    if (currentWidth < targetWidth) {
        return [...row, ...Array.from({ length: targetWidth - currentWidth }).fill(null)] as CellType[];
    }

    return row;
};
