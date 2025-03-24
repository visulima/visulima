import type { Cell as CellType } from "../types";

/** Computes the logical width of a row (the sum of colSpans, defaulting to 1 per cell). */
const computeRowLogicalWidth = (row: CellType[]): number =>
    // eslint-disable-next-line unicorn/no-array-reduce
     row.reduce((total: number, cell: CellType) => {
        if (cell === null) {
            return total + 1;
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            const colSpan = cell.colSpan ?? 1;

            return total + (colSpan > 0 ? colSpan : 1);
        }

        return total + 1;
    }, 0)
;

export default computeRowLogicalWidth;
