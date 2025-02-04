import type { LayoutCell } from "../types";

/** Gets the real cell from a layout cell (following the parentCell chain). */
export const getRealCell = (layoutCell: LayoutCell | null): LayoutCell | null => {
    if (!layoutCell) {
        return null;
    }

    if (layoutCell.isSpanCell && layoutCell.parentCell) {
        return layoutCell.parentCell;
    }

    return layoutCell;
};
