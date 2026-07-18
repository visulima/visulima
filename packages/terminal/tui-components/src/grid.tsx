/* eslint-disable react/function-component-definition */
import Box from "@visulima/tui/components/box";
import type { ReactElement, ReactNode } from "react";
import { Children } from "react";

export type Props = {
    /**
     * The grid cells, filled left-to-right, top-to-bottom.
     */
    readonly children: ReactNode;

    /**
     * Horizontal gap between columns, in cells.
     * @default 1
     */
    readonly columnGap?: number;

    /**
     * Number of columns. Children wrap into as many rows as needed.
     * @default 2
     */
    readonly columns?: number;

    /**
     * Fixed width for every column, in cells. Omit to let columns size to
     * their content.
     */
    readonly columnWidth?: number;

    /**
     * Vertical gap between rows, in cells.
     * @default 0
     */
    readonly rowGap?: number;
};

/**
 * A simple 2D grid: children flow left-to-right into a fixed number of columns,
 * wrapping to new rows. Column and row gaps are configurable, and columns can
 * be given a fixed width for uniform cells.
 */
export default function Grid({ children, columnGap = 1, columns = 2, columnWidth, rowGap = 0 }: Props): ReactElement {
    // Children.toArray is the right tool here: it flattens fragments and
    // assigns stable keys before we slice the flat list into grid rows.
    // eslint-disable-next-line react-x/no-children-to-array -- intentional flatten for 2D layout
    const cells = Children.toArray(children);
    const rows: ReactNode[][] = [];
    // Guard against columns <= 0, which would never advance the loop.
    const columnCount = Math.max(1, columns);

    for (let index = 0; index < cells.length; index += columnCount) {
        rows.push(cells.slice(index, index + columnCount));
    }

    return (
        <Box flexDirection="column" gap={rowGap}>
            {rows.map((row, rowIndex) => (
                // eslint-disable-next-line react-x/no-array-index-key -- row index is stable for the render
                <Box gap={columnGap} key={rowIndex}>
                    {row.map((cell, columnIndex) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- cell index is stable for the render
                        <Box flexShrink={0} key={columnIndex} width={columnWidth}>
                            {cell}
                        </Box>
                    ))}
                </Box>
            ))}
        </Box>
    );
}

export { Grid };
export type { Props as GridProps };
