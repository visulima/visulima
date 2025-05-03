import type { GridCell, GridItem, InternalGridItem } from "../types";

export const EMPTY_CELL_REPRESENTATION = "__EMPTY__";

/**
 * Normalizes a GridCell input into an InternalGridItem.
 * Ensures the 'content' property is always a string.
 *
 * @param cell - The input cell (string, number, null, undefined, or GridItem object).
 * @returns The normalized InternalGridItem.
 *
 * @throws {TypeError} If the input cell type is invalid.
 */
export const normalizeGridCell = (cell: GridCell): InternalGridItem => {
    if (typeof cell === "string") {
        return { content: cell } as InternalGridItem;
    }

    if (typeof cell === "number" || typeof cell === "bigint" || typeof cell === "boolean") {
        return { content: String(cell) } as InternalGridItem;
    }

    if (cell === null || cell === undefined) {
        return { content: EMPTY_CELL_REPRESENTATION } as InternalGridItem; // Represent null/undefined as empty string
    }

    if (typeof cell === "object" && "content" in cell) {
        let { content } = cell;

        if (typeof content === "number" || typeof content === "bigint" || typeof content === "boolean") {
            content = String(content);
        } else if (content === null || content === undefined) {
            content = EMPTY_CELL_REPRESENTATION;
        } else if (typeof content !== "string") {
            throw new TypeError(
                `Invalid item type in grid cell: expected string, number, null, undefined, or GridItem object, but received ${String(cell)} (type: ${typeof cell})`,
            );
        }

        return { ...(cell as GridItem), content } as InternalGridItem;
    }

    // If it's none of the above, throw an error (e.g., bigint, boolean, function)
    // Use String() for potentially non-primitive types in the error message
    throw new TypeError(
        `Invalid item type in grid cell: expected string, number, null, undefined, or GridItem object, but received ${String(cell)} (type: ${typeof cell})`,
    );
};
