/**
 * Calculates the total width of a cell spanning multiple columns, including gaps and border join widths.
 * @param columnWidths Array of column widths.
 * @param col Starting column index.
 * @param colSpan Number of columns the cell spans.
 * @returns The total width for the spanned cell.
 */
const calculateCellTotalWidth = (columnWidths: number[], col: number, colSpan: number): number => {
    let totalWidth = 0;

    // Add width of all spanned columns
    for (let index = 0; index < colSpan; index += 1) {
        totalWidth += columnWidths[col + index] ?? 0;
    }

    if (colSpan > 1) {
        totalWidth += colSpan - 1;
    }

    return totalWidth;
};

export default calculateCellTotalWidth;
