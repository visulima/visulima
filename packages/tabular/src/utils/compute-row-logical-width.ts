import type { TableCell } from "../types";

/**
 * Computes the logical width of a table row by summing up the effective width of each cell.
 * The effective width is determined as follows:
 * - For null cells: counts as 1 column
 * - For object cells with colSpan: uses the colSpan value (defaults to 1 if not specified or invalid)
 * - For all other cells (strings, etc.): counts as 1 column
 *
 * @param row - Array of table cells, where each cell can be null, a string, or an object with optional colSpan
 * @returns The total logical width of the row (sum of all cell widths/spans)
 *
 * @example
 * ```ts
 * // Row with mixed cell types
 * const row = [null, "cell", { colSpan: 2, content: "wide" }];
 * computeRowLogicalWidth(row); // Returns 4 (1 + 1 + 2)
 * ```
 */
const computeRowLogicalWidth = (row: TableCell[]): number =>
    // eslint-disable-next-line unicorn/no-array-reduce
    row.reduce((total: number, cell: TableCell) => {
        if (cell === null) {
            return total + 1;
        }

        if (typeof cell === "object" && !Array.isArray(cell)) {
            cell.colSpan = cell.colSpan ?? 1;

            if (cell.colSpan <= 0) {
                return total + 1;
            }

            return total + cell.colSpan;
        }

        return total + 1;
    }, 0) as number;

export default computeRowLogicalWidth;
