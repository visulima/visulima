import type { LayoutCell } from "../types";

/** Gets the real cell from a layout cell by recursively following the parentCell chain until a non-span cell is found. */
const getRealCell = (layoutCell: LayoutCell | null): LayoutCell | null => {
    if (!layoutCell) {
        return null;
    }

    // If this is a span cell with a parent, recursively get the real cell of the parent
    if (layoutCell.isSpanCell && layoutCell.parentCell) {
        return getRealCell(layoutCell.parentCell);
    }

    // Return the current cell if it's not a span cell or has no parent
    return layoutCell;
};

export default getRealCell;