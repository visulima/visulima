import type { BorderStyle, HorizontalAlignment } from "@visulima/tabular";
import { Table as TabularTable } from "@visulima/tabular";
import {
    ASCII_BORDER,
    BLOCK_BORDER,
    DEFAULT_BORDER,
    DOTS_BORDER,
    DOUBLE_BORDER,
    MARKDOWN_BORDER,
    MINIMAL_BORDER,
    NO_BORDER,
    ROUNDED_BORDER,
    THICK_BORDER,
} from "@visulima/tabular/style";
import type { ReactElement } from "react";
import { useMemo } from "react";

import Text from "./text";

/**
 * Scalar value that can be displayed in a table cell.
 */
type Scalar = bigint | boolean | number | string | null | undefined;

/**
 * Dictionary with scalar values, representing a single row of data.
 */
type ScalarDict = Record<string, Scalar>;

/**
 * Configuration for a single table column.
 */
type ColumnConfig<T extends ScalarDict> = {
    /**
     * Horizontal alignment of cell content.
     */
    readonly align?: HorizontalAlignment;

    /**
     * Custom header label. Defaults to the key name.
     */
    readonly header?: string;

    /**
     * Key from the data object to display in this column.
     */
    readonly key: keyof T & string;

    /**
     * Fixed width for this column in characters.
     */
    readonly width?: number;
};

type Props<T extends ScalarDict> = {
    /**
     * Border style preset name or a custom `BorderStyle` object from `@visulima/tabular`.
     * @default "default"
     */
    readonly borderStyle?: "ascii" | "block" | "default" | "dots" | "double" | "markdown" | "minimal" | "none" | "rounded" | "thick" | BorderStyle;

    /**
     * Columns to display and their order.
     * Accepts simple key strings or `ColumnConfig` objects for advanced control.
     * If omitted, all keys from the first data item are used.
     */
    readonly columns?: ((keyof T & string) | ColumnConfig<T>)[];

    /**
     * Array of objects to display as rows.
     */
    readonly data: T[];

    /**
     * Format a cell value before rendering. Return a string to display in the cell.
     */
    readonly formatCell?: (value: Scalar, column: keyof T & string, rowIndex: number) => string;

    /**
     * Format a header label before rendering. Return a string to display as the column header.
     */
    readonly formatHeader?: (column: keyof T & string) => string;

    /**
     * Maximum width of the table in characters. Columns will be truncated or wrapped to fit.
     */
    readonly maxWidth?: number;

    /**
     * Cell padding (left and right) in characters.
     * @default 1
     */
    readonly padding?: number;

    /**
     * Whether to show the header row.
     * @default true
     */
    readonly showHeader?: boolean;

    /** Placeholder shown in place of `null` or `undefined` cell values. Defaults to an empty string. */
    readonly skeleton?: string;

    /**
     * Enable word wrap instead of truncation when cells exceed their width.
     * @default false
     */
    readonly wordWrap?: boolean;
};

const BORDER_PRESETS: Record<string, BorderStyle> = {
    ascii: ASCII_BORDER,
    block: BLOCK_BORDER,
    default: DEFAULT_BORDER,
    dots: DOTS_BORDER,
    double: DOUBLE_BORDER,
    markdown: MARKDOWN_BORDER,
    minimal: MINIMAL_BORDER,
    none: NO_BORDER,
    rounded: ROUNDED_BORDER,
    thick: THICK_BORDER,
};

/**
 * Render a data table in the terminal.
 *
 * Uses `@visulima/tabular` as the rendering engine, supporting multiple border styles,
 * column configuration, cell formatting, and word wrap.
 * @example
 * ```tsx
 * import { Table } from "@visulima/tui/ink";
 *
 * const data = [
 *     { name: "Alice", age: 30 },
 *     { name: "Bob", age: 25 },
 * ];
 *
 * <Table data={data} />
 * <Table data={data} borderStyle="rounded" padding={2} />
 * ```
 */
const toColumnConfig = <T extends ScalarDict>(col: (keyof T & string) | ColumnConfig<T>): ColumnConfig<T> => {
    if (typeof col === "string") {
        return { key: col };
    }

    return col;
};

const TableComponent = <T extends ScalarDict>({
    borderStyle = "default",
    columns: columnsProp,
    data,
    formatCell,
    formatHeader,
    maxWidth,
    padding = 1,
    showHeader = true,
    skeleton = "",
    wordWrap = false,
}: Props<T>): ReactElement => {
    const tableString = useMemo((): string => {
        if (data.length === 0) {
            return "";
        }

        // Resolve column configs
        let resolvedColumns: ColumnConfig<T>[];

        if (columnsProp) {
            resolvedColumns = columnsProp.map((col) => toColumnConfig(col));
        } else {
            resolvedColumns = (Object.keys(data[0] as object) as (keyof T & string)[]).map((key) => {
                return { key };
            });
        }

        if (resolvedColumns.length === 0) {
            return "";
        }

        // Resolve border style
        const border = typeof borderStyle === "string" ? (BORDER_PRESETS[borderStyle] ?? DEFAULT_BORDER) : borderStyle;

        // Build column widths array (undefined entries let tabular auto-calculate)
        const columnWidths: (number | undefined)[] = resolvedColumns.map((col) => col.width);
        const hasFixedWidths = columnWidths.some((w) => w !== undefined);

        const table = new TabularTable({
            columnWidths: hasFixedWidths ? columnWidths : undefined,
            maxWidth,
            showHeader,
            style: {
                border,
                paddingLeft: padding,
                paddingRight: padding,
            },
            wordWrap,
        });

        // Set headers
        if (showHeader) {
            const headers = resolvedColumns.map((col) => {
                const label = col.header ?? col.key;

                return formatHeader ? formatHeader(col.key) : label;
            });

            table.setHeaders(headers);
        }

        // Add data rows
        for (const [rowIndex, row] of data.entries()) {
            const cells = resolvedColumns.map((col) => {
                const value = row[col.key];

                if (formatCell) {
                    return formatCell(value, col.key, rowIndex);
                }

                // eslint-disable-next-line sonarjs/different-types-comparison, @typescript-eslint/no-unnecessary-condition
                return value === undefined || value === null ? skeleton : String(value);
            });

            table.addRow(cells);
        }

        return table.toString();
    }, [borderStyle, columnsProp, data, formatCell, formatHeader, maxWidth, padding, showHeader, skeleton, wordWrap]);

    return <Text>{tableString}</Text>;
};

const Table = TableComponent as <T extends ScalarDict>(props: Props<T>) => ReactElement;

export default Table;
export { Table };
export type { ColumnConfig, Props, Scalar, ScalarDict };
export type { ColumnConfig as TableColumnConfig, Props as TableProps, Scalar as TableScalar, ScalarDict as TableScalarDict };
