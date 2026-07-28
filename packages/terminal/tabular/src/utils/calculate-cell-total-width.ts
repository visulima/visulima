/**
 * Calculates the total width of a cell spanning multiple columns, including the
 * structural width of the internal column boundaries the cell renders over.
 * @param columnWidths Array of column widths.
 * @param col Starting column index.
 * @param colSpan Number of columns the cell spans.
 * @param joinWidth Width of a single internal column boundary the spanning cell covers (0 when no vertical join is rendered, e.g. NO_BORDER). Defaults to 1 to preserve the historical single-char join assumption.
 * @returns The total width for the spanned cell.
 */
const calculateCellTotalWidth = (columnWidths: number[], col: number, colSpan: number, joinWidth = 1): number => {
    let totalWidth = 0;

    // Add width of all spanned columns
    for (let index = 0; index < colSpan; index += 1) {
        totalWidth += columnWidths[col + index] ?? 0;
    }

    if (colSpan > 1) {
        totalWidth += (colSpan - 1) * joinWidth;
    }

    return totalWidth;
};

export default calculateCellTotalWidth;
