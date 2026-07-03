import type { TruncateOptions, WordWrapOptions } from "@visulima/string";

/** Base options common to Table and Grid */
interface BaseRenderingOptions {
    /** Automatically balance column widths for optimal content fit when no fixed widths are specified */
    balancedWidths?: boolean;

    /** Gap between cells */
    gap?: number;

    /** Maximum width for the entire table/grid. */
    maxWidth?: number;

    /**
     * Optional handler for non-fatal diagnostics emitted during rendering.
     * When provided it replaces the default `console.warn`, so a library
     * consumer can capture, suppress, or re-route these messages instead of
     * having them leak to stderr. Defaults to `console.warn`.
     */
    onWarn?: WarnHandler;

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

/**
 * Handler invoked for non-fatal diagnostics (e.g. an item that could not be
 * placed in the grid). Receiving a handler lets consumers route these messages
 * to their own logger instead of polluting stderr via `console.warn`.
 */
export type WarnHandler = (message: string) => void;

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

    /**
     * Exact width for this cell, overrides table-level columnWidths.
     *
     * NOTE: This field is only consumed by `Table` (it is folded into the
     * table-level fixed column widths). When using `Grid` directly, this value
     * is ignored — Grid width calculation only reads `maxWidth` and `colSpan`.
     */
    width?: number;

    /** Options for controlling word wrapping (takes precedence over truncate) */
    wordWrap?: Omit<WordWrapOptions, "width"> | boolean;
}

/** Input type for a cell, can be primitive or an options object */
export type GridCell = Content | GridItem;

/** Represents a GridItem with content guaranteed to be a string */
export interface InternalGridItem extends GridItem {
    content: string;

    /**
     * Internal flag marking a cell that originated from `null`/`undefined`
     * input (an "empty" placeholder cell). Used by the layout engine to skip
     * placement for non-spanning empty cells without relying on a magic content
     * string that could collide with legitimate user content.
     * @internal
     */
    isEmpty?: boolean;
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
 * Per-column default cell options applied to every cell in a column unless the
 * cell overrides them. A convenience for the common "right-align this numeric
 * column" / "wrap this column" story without setting options on every cell.
 */
export interface ColumnDefault {
    /** Default horizontal alignment for cells in this column. */
    hAlign?: HorizontalAlignment;

    /** Default maximum width for cells in this column. */
    maxWidth?: number;

    /** Default truncation behaviour for cells in this column. */
    truncate?: TruncateOptions | boolean;

    /** Default vertical alignment for cells in this column. */
    vAlign?: VerticalAlignment;

    /** Default word-wrap behaviour for cells in this column. */
    wordWrap?: Omit<WordWrapOptions, "width"> | boolean;
}

/**
 * Options specific to Table construction.
 */
export interface TableOptions extends BaseRenderingOptions {
    /**
     * Per-column default horizontal alignment, indexed by column. A shorthand
     * for `columnDefaults[i].hAlign`. Cell-level `hAlign` always wins.
     */
    colAligns?: (HorizontalAlignment | undefined)[];

    /**
     * Per-column default options, indexed by column. Applied to every cell in
     * the column unless the individual cell overrides the same option.
     */
    columnDefaults?: (ColumnDefault | undefined)[];

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

    /** Whether to show the footer of the table */
    showFooter?: boolean;

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
