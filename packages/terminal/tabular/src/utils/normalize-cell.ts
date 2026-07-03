import type { GridCell, InternalGridItem } from "../types";

/**
 * Normalizes a GridCell input into an InternalGridItem.
 * Ensures the 'content' property is always a string.
 *
 * Cells that originate from `null`/`undefined` are normalized to an empty
 * string and tagged with the internal `isEmpty` flag, so the layout engine can
 * recognize them without resorting to a magic content string that could collide
 * with legitimate user content (e.g. a cell literally containing `"__EMPTY__"`).
 * @param cell The input cell (string, number, null, undefined, or GridItem object).
 * @returns The normalized InternalGridItem.
 * @throws {TypeError} If the input cell type is invalid.
 */
// eslint-disable-next-line import/prefer-default-export -- named export kept; this util is imported by name across the package.
export const normalizeGridCell = (cell: GridCell): InternalGridItem => {
    if (typeof cell === "string") {
        return { content: cell };
    }

    if (typeof cell === "number" || typeof cell === "bigint" || typeof cell === "boolean") {
        return { content: String(cell) };
    }

    if (cell === null || cell === undefined) {
        return { content: "", isEmpty: true };
    }

    if (typeof cell === "object" && "content" in cell) {
        let { content } = cell;
        let isEmpty = false;

        if (typeof content === "number" || typeof content === "bigint" || typeof content === "boolean") {
            content = String(content);
        } else if (content === null || content === undefined) {
            content = "";
            isEmpty = true;
        } else if (typeof content !== "string") {
            throw new TypeError(
                `Invalid item type in grid cell: expected string, number, null, undefined, or GridItem object, but received ${JSON.stringify(cell)} (type: ${typeof cell})`,
            );
        }

        return isEmpty ? { ...cell, content, isEmpty: true } : { ...cell, content };
    }

    // If it's none of the above, throw an error (e.g., function, symbol).
    // Use JSON.stringify for potentially non-primitive types in the error message.
    throw new TypeError(
        `Invalid item type in grid cell: expected string, number, null, undefined, or GridItem object, but received ${JSON.stringify(cell)} (type: ${typeof cell})`,
    );
};
