/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type DataGridColumn<Row> = {
    readonly align?: "left" | "right";
    readonly header: string;
    readonly key: keyof Row & string;

    /**
     * Render a cell to a string. Defaults to `String(row[key])`.
     */
    readonly render?: (row: Row) => string;
    readonly width?: number;
};

export type Props<Row extends Record<string, unknown>> = {
    /**
     * Accent color for the cursor row and active sort column.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus for keyboard navigation.
     */
    readonly autoFocus?: boolean;

    /**
     * Column definitions in display order.
     */
    readonly columns: ReadonlyArray<DataGridColumn<Row>>;

    /**
     * The rows to display.
     */
    readonly data: ReadonlyArray<Row>;

    /**
     * Fires with the row under the cursor when Enter is pressed.
     */
    readonly onSelect?: (row: Row) => void;
};

type SortState = { readonly direction: "asc" | "desc"; readonly key: string } | undefined;

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

const cellText = <Row extends Record<string, unknown>>(column: DataGridColumn<Row>, row: Row): string => {
    if (column.render) {
        return column.render(row);
    }

    return String(row[column.key] ?? "");
};

const pad = (text: string, width: number, align: "left" | "right"): string => {
    if (text.length >= width) {
        return text.slice(0, width);
    }

    return align === "right" ? text.padStart(width) : text.padEnd(width);
};

/**
 * A navigable, sortable table. ↑/↓ move the row cursor, ←/→ move the column
 * cursor, `s` sorts by the cursor column (toggling direction), and Enter fires
 * `onSelect` with the current row. Column widths default to the widest cell.
 */
export default function DataGrid<Row extends Record<string, unknown>>({
    accentColor = "blue",
    autoFocus = false,
    columns,
    data,
    onSelect,
}: Props<Row>): ReactElement {
    const { isFocused } = useFocus({ autoFocus });

    const [rowCursor, setRowCursor] = useState(0);
    const [columnCursor, setColumnCursor] = useState(0);
    const [sort, setSort] = useState<SortState>(undefined);

    const widths = useMemo(
        () =>
            columns.map((column) => {
                if (column.width !== undefined) {
                    return column.width;
                }

                // Reserve two trailing cells for the " ▲"/" ▼" sort indicator so
                // it never truncates the header once the column becomes active.
                let max = column.header.length + 2;

                for (const row of data) {
                    max = Math.max(max, cellText(column, row).length);
                }

                return max;
            }),
        [columns, data],
    );

    const sorted = useMemo(() => {
        if (sort === undefined) {
            return data;
        }

        const column = columns.find((candidate) => candidate.key === sort.key);

        if (column === undefined) {
            return data;
        }

        const factor = sort.direction === "asc" ? 1 : -1;

        return [...data].toSorted((a, b) => {
            const left = cellText(column, a);
            const right = cellText(column, b);
            const leftNumber = Number(left);
            const rightNumber = Number(right);
            const bothNumeric = left.length > 0 && right.length > 0 && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);

            return factor * (bothNumeric ? leftNumber - rightNumber : left.localeCompare(right));
        });
    }, [columns, data, sort]);

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; leftArrow: boolean; return: boolean; rightArrow: boolean; upArrow: boolean }) => {
            if (key.upArrow) {
                setRowCursor((index) => wrap(index - 1, sorted.length));
            } else if (key.downArrow) {
                setRowCursor((index) => wrap(index + 1, sorted.length));
            } else if (key.leftArrow) {
                setColumnCursor((index) => wrap(index - 1, columns.length));
            } else if (key.rightArrow) {
                setColumnCursor((index) => wrap(index + 1, columns.length));
            } else if (input === "s") {
                const column = columns[columnCursor];

                if (column !== undefined) {
                    setSort((current) => {
                        if (current?.key === column.key && current.direction === "asc") {
                            return { direction: "desc", key: column.key };
                        }

                        return { direction: "asc", key: column.key };
                    });
                }
            } else if (key.return) {
                const row = sorted[rowCursor];

                if (row !== undefined) {
                    onSelect?.(row);
                }
            }
        },
        [columnCursor, columns, onSelect, rowCursor, sorted],
    );

    useInput(inputHandler, { isActive: isFocused });

    const sortArrow = (columnKey: string): string => {
        if (sort?.key !== columnKey) {
            return "";
        }

        return sort.direction === "asc" ? " ▲" : " ▼";
    };

    return (
        <Box flexDirection="column">
            <Box>
                <Text> </Text>
                {columns.map((column, index) => {
                    const isSortColumn = isFocused && index === columnCursor;

                    return (
                        <Box key={column.key} marginRight={1}>
                            <Text bold color={isSortColumn ? accentColor : undefined}>
                                {pad(`${column.header}${sortArrow(column.key)}`, widths[index]!, column.align ?? "left")}
                            </Text>
                        </Box>
                    );
                })}
            </Box>
            {sorted.map((row, rowIndex) => {
                const isActive = isFocused && rowIndex === rowCursor;

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- row index is stable for the render
                    <Box key={rowIndex}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯" : " "}</Text>
                        {columns.map((column, columnIndex) => (
                            <Box key={column.key} marginRight={1}>
                                <Text color={isActive ? accentColor : undefined} dimColor={!isActive}>
                                    {pad(cellText(column, row), widths[columnIndex]!, column.align ?? "left")}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                );
            })}
        </Box>
    );
}

export { DataGrid };
export type { Props as DataGridProps };
