import type { TruncateOptions, WordWrapOptions } from "@visulima/string";

export type AnsiColorFunction = (text: string) => string;

export type AnsiColorObject = {
    close: string;
    open: string;
};

export type Content = bigint | boolean | number | string | null | undefined;

/**
 * Style options for a cell.
 */
export type CellStyle = {
    /**
     * Default background color for all cells unless overridden by cell-specific options.
     * Can be a function that takes text and returns styled text,
     * or an object with ANSI escape sequences for opening and closing the style.
     */
    backgroundColor?: AnsiColorFunction | AnsiColorObject;

    /**
     * Array of style names for the cell's border.
     */
    border?: string[];

    /**
     * Default foreground color for all cells unless overridden by cell-specific options.
     * Can be a function that takes text and returns styled text,
     * or an object with ANSI escape sequences for opening and closing the style.
     */
    foregroundColor?: AnsiColorFunction | AnsiColorObject;

    /**
     * Array of style names for the cell's head.
     */
    head?: string[];

    /**
     * Left padding of the cell content.
     */
    paddingLeft?: number;

    /**
     * Right padding of the cell content.
     */
    paddingRight?: number;
};

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

    /**
     * TODO: Check if this is needed
     * Style options for the cell.
     */
    style?: CellStyle;
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

export interface Style {
    /**
     * Default background color for all cells unless overridden by cell-specific options.
     * Can be a function that takes text and returns styled text,
     * or an object with ANSI escape sequences for opening and closing the style.
     */
    backgroundColor?: ((text: string) => string) | { close: string; open: string };

    /**
     * Border style configuration.
     */
    border?: BorderStyle;

    /**
     * Default foreground color for all cells unless overridden by cell-specific options.
     * Can be a function that takes text and returns styled text,
     * or an object with ANSI escape sequences for opening and closing the style.
     */
    foregroundColor?: ((text: string) => string) | { close: string; open: string };

    /**
     * Left padding for all cells.
     */
    paddingLeft?: number;

    /**
     * Right padding for all cells.
     */
    paddingRight?: number;
}

/**
 * Defines the options for table construction.
 */
export interface TableOptions {
    /**
     * Fixed column widths for specific columns. Content exceeding the width will be truncated
     * based on the truncate options.
     * Can specify width for all columns with a single number or for specific columns with an array.
     */
    columnWidths?: number[] | number;

    /** Default terminal width to use for calculations (defaults to 80) */
    defaultTerminalWidth?: number;

    /**
     * Gap between cells (overrides style.gap)
     */
    gap?: number;

    /**
     * Maximum width for the entire table.
     */
    maxWidth?: number;

    /**
     * Fixed row heights for specific rows. Content exceeding the height will be truncated
     * with an ellipsis symbol on the last line.
     * Can specify height for all rows with a single number or for specific rows with an array.
     */
    rowHeights?: number[] | number;

    /**
     * Whether to show the header of the table
     */
    showHeader?: boolean;

    /**
     * The style options for the table
     */
    style?: Partial<
        Style & {
            /** Color for the border */
            borderColor?: ((text: string) => string) | { close: string; open: string };
        }
    >;

    /** Terminal width to use for calculations (defaults to actual terminal width) */
    terminalWidth?: number;

    /**
     * The number of spaces to use for tab characters.
     */
    transformTabToSpace?: number;

    /**
     * Options for controlling how text is truncated when it exceeds maxWidth
     */
    truncate?: TruncateOptions;

    /**
     * Whether to enable word wrapping.
     */
    wordWrap?: Omit<WordWrapOptions, "width"> | boolean;
}

export type VerticalAlignment = "bottom" | "middle" | "top";
export type HorizontalAlignment = "center" | "left" | "right";
export type AutoFlowDirection = "column" | "row";
export type BorderType = "bottom" | "middle" | "top";

// Moved from grid.ts
export interface GridOptions extends Style {
    /** Default number of columns for auto-generated cells */
    autoColumns?: number;
    /** Direction of auto-flow when adding items */
    autoFlow?: AutoFlowDirection;
    /** Default number of rows for auto-generated cells */
    autoRows?: number;
    /** Color for the border */
    borderColor?: ((text: string) => string) | { close: string; open: string };
    /** Number of columns in the grid */
    columns: number;
    /** Default terminal width to use for calculations (defaults to 80) */
    defaultTerminalWidth?: number;
    /** Fixed column widths */
    fixedColumnWidths?: number[];
    /** Fixed row heights */
    fixedRowHeights?: number[];
    /** Gap between cells */
    gap?: number;
    /** Maximum width for the entire grid */
    maxWidth?: number;
    /** Number of rows in the grid (0 for auto) */
    rows?: number;
    /** Whether to show borders (only relevant if border is defined) */
    showBorders?: boolean;
    /** Terminal width to use for calculations (defaults to actual terminal width) */
    terminalWidth?: number;
    /** Whether to truncate content */
    truncate?: TruncateOptions | boolean;
    /** Whether to wrap content in cells (takes precedence over truncate) */
    wordWrap?: WordWrapOptions | boolean;
}
