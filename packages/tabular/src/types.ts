import type { TruncateOptions, WordWrapOptions } from "@visulima/string";

/** Base options common to Table and Grid */
interface BaseRenderingOptions {
    /** Automatically balance column widths for optimal content fit when no fixed widths are specified */
    balancedWidths?: boolean;

    /** Gap between cells */
    gap?: number;

    /** Maximum width for the entire table/grid. */
    maxWidth?: number;

    /** Explicit terminal width (overrides detected) */
    terminalWidth?: number;

    /** Global truncation options/flag */

    truncate?: TruncateOptions | boolean;

    /**
     * Whether to truncate content that exceeds cell width when truncate/wrap are disabled (default: true)
     * @deprecated This option is deprecated and will be removed in a future version. Use `truncate` or `wordWrap` options instead.
     */
    truncateOverflow?: boolean;

    /** Global word wrap options/flag */
    wordWrap?: Omit<WordWrapOptions, "width"> | boolean;
}

export type AnsiColorFunction = (text: string) => string;

export type AnsiColorObject = {
    close: string;
    open: string;
};

export type Content = bigint | boolean | number | string | null | undefined;

export interface GridItem {
    /** Background color for the entire cell (including padding) */
    backgroundColor?: AnsiColorFunction | AnsiColorObject;

    /** Number of columns this cell spans */
    colSpan?: number;

    /** Content to display in the cell */
    content: Content;

    /** Foreground color for the entire cell (including padding) */
    foregroundColor?: AnsiColorFunction | AnsiColorObject;

    /** Horizontal alignment of the content */
    hAlign?: HorizontalAlignment;

    /** Maximum width of the cell content before truncation */
    maxWidth?: number;

    /** Number of rows this cell spans */
    rowSpan?: number;

    /** Options for controlling how text is truncated when it exceeds maxWidth */

    truncate?: TruncateOptions | boolean;

    /** Vertical alignment of the content */
    vAlign?: VerticalAlignment;

    /** Exact width for this cell, overrides table-level columnWidths */
    width?: number;

    /** Options for controlling word wrapping (takes precedence over truncate) */
    wordWrap?: Omit<WordWrapOptions, "width"> | boolean;
}

/** Input type for a cell, can be primitive or an options object */
export type GridCell = Content | GridItem;

/** Represents a GridItem with content guaranteed to be a string */
export interface InternalGridItem extends GridItem {
    content: string;
}

export interface TableItem extends GridItem {
    /**
     * Optional URL for making the cell content a hyperlink.
     */
    href?: string;
}

export type TableCell = Content | TableItem;

export interface BorderComponent {
    char: string;
    width: number;
}

/**
 * Represents the style of the border for a table or grid.
 */
export interface BorderStyle {
    /** Box vertical character. */
    bodyJoin: BorderComponent;

    /** Box vertical character. */
    bodyLeft: BorderComponent;

    /** Box vertical character. */
    bodyRight: BorderComponent;

    /** Box horizontal character. */
    bottomBody: BorderComponent;

    /** Box bottom join character. */
    bottomJoin: BorderComponent;

    /** Box bottom left character. */
    bottomLeft: BorderComponent;

    /** Box bottom right character. */
    bottomRight: BorderComponent;

    /** Box horizontal character. */
    joinBody: BorderComponent;

    /** Box horizontal join character. */
    joinJoin: BorderComponent;

    /** Box left join character. */
    joinLeft: BorderComponent;

    /** Box right join character. */
    joinRight: BorderComponent;

    /** Box horizontal character. */
    topBody: BorderComponent;

    /** Box top join character. */
    topJoin: BorderComponent;

    /** Box top left character. */
    topLeft: BorderComponent;

    /** Box top right character. */
    topRight: BorderComponent;
}

/** Base style properties applicable globally */
export interface Style {
    /** Global background color */
    backgroundColor?: AnsiColorFunction | AnsiColorObject;

    /** Border style configuration. */
    border?: BorderStyle;

    /** Global border color */
    borderColor?: AnsiColorFunction | AnsiColorObject;

    /** Global foreground color */
    foregroundColor?: AnsiColorFunction | AnsiColorObject;

    /** Global left padding */
    paddingLeft?: number;

    /** Global right padding */
    paddingRight?: number;
}

/**
 * Options specific to Table construction.
 */
export interface TableOptions extends BaseRenderingOptions {
    /**
     * Fixed column widths.
     * Can be a single number for all columns or an array for specific columns.
     * Array entries can be undefined to allow automatic width calculation for that column.
     */
    columnWidths?: (number | undefined)[] | number;

    /**
     * Fixed row heights.
     * Can be a single number for all rows or an array for specific rows.
     */
    rowHeights?: number[] | number;

    /** Whether to show the header of the table */
    showHeader?: boolean;

    /** Global style options for the table */
    style?: Partial<Style>;

    /** Number of spaces for tab characters */
    transformTabToSpace?: number;
}

export type VerticalAlignment = "bottom" | "middle" | "top";
export type HorizontalAlignment = "center" | "left" | "right";
export type AutoFlowDirection = "column" | "row";
export type BorderType = "bottom" | "middle" | "top";

/**
 * Options specific to Grid construction.
 */
export interface GridOptions extends BaseRenderingOptions, Style {
    /** Default number of columns for auto-generated cells */
    autoColumns?: number;

    /** Direction of auto-flow when adding items */
    autoFlow?: AutoFlowDirection;

    /** Default number of rows for auto-generated cells */
    autoRows?: number;

    /** Number of columns in the grid */
    columns: number;

    /** Fixed column widths. Undefined entries allow automatic width calculation for that column. */
    fixedColumnWidths?: (number | undefined)[];

    /** Fixed row heights */
    fixedRowHeights?: number[];

    /** Number of rows in the grid (0 for auto) */
    rows?: number;

    /** Whether to show borders (only relevant if border is defined) */
    showBorders?: boolean;
}
