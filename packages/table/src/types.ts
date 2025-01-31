/**
 * Represents horizontal alignment options for table cells.
 */
export type HorizontalAlign = "center" | "left" | "right";

/**
 * Represents vertical alignment options for table cells.
 */
export type VerticalAlign = "bottom" | "middle" | "top";

/**
 * Represents the position of a cell in a table.
 */
export interface CellPosition {
    /**
     * The x-coordinate (column) of the cell.
     */
    x: number | null;

    /**
     * The y-coordinate (row) of the cell.
     */
    y: number | null;
}

export type Border = {
    body: string;
    left: string;
    middle: string;
    right: string;
};

/**
 * Style options for a cell.
 */
export type CellStyle = {
    /**
     * Array of style names for the cell's border.
     */
    border?: string[];

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

/**
 * Configuration options for a table cell.
 */
export interface CellOptions {
    /**
     * Number of columns this cell spans.
     */
    colSpan?: number;

    /**
     * The content of the cell.
     */
    content: number | string | null | undefined;

    /**
     * Horizontal alignment of the cell content.
     */
    hAlign?: HorizontalAlign;

    /**
     * Optional URL for making the cell content a hyperlink.
     */
    href?: string;

    /**
     * Maximum width of the cell content before truncation.
     */
    maxWidth?: number;

    /**
     * Number of rows this cell spans.
     */
    rowSpan?: number;

    /**
     * Style options for the cell.
     */
    style?: CellStyle;

    /**
     * Vertical alignment of the cell content.
     */
    vAlign?: VerticalAlign;

    /**
     * Whether to word wrap the cell content.
     */
    wordWrap?: boolean;
}

export type Cell = CellOptions | number | string | null | undefined;

/**
 * Defines the border style configuration for tables.
 */
export interface BorderStyle {
    /**
     * Character for joining body borders.
     */
    bodyJoin?: string;
    /**
     * Character for the left border body.
     */
    bodyLeft?: string;
    /**
     * Character for the right border body.
     */
    bodyRight?: string;
    /**
     * Character for the bottom border body.
     */
    bottomBody?: string;

    /**
     * Character for joining bottom borders.
     */
    bottomJoin?: string;
    /**
     * Character for the bottom-left corner.
     */
    bottomLeft?: string;
    /**
     * Character for the bottom-right corner.
     */
    bottomRight?: string;
    /**
     * Character for the join body.
     */
    joinBody?: string;

    /**
     * Character for joining.
     */
    joinJoin?: string;
    /**
     * Character for the left join.
     */
    joinLeft?: string;
    /**
     * Character for the right join.
     */
    joinRight?: string;

    /**
     * Character for the top border body.
     */
    topBody?: string;
    /**
     * Character for joining top borders.
     */
    topJoin?: string;
    /**
     * Character for the top-left corner.
     */
    topLeft?: string;
    /**
     * Character for the top-right corner.
     */
    topRight?: string;
}

/**
 * Defines the style options for a table.
 */
export interface TableStyle {
    /**
     * The border style configuration.
     */
    border?: BorderStyle;
    /**
     * The padding to apply to the left side of cells.
     */
    paddingLeft?: number;
    /**
     * The padding to apply to the right side of cells.
     */
    paddingRight?: number;
    /**
     * Whether to word wrap cell content by default.
     */
    wordWrap?: boolean;
}

/**
 * Defines the options for table construction.
 */
export interface TableConstructorOptions {
    /**
     * Whether to show the header of the table
     */
    showHeader?: boolean;

    /**
     * The style options for the table
     */
    style?: Partial<TableStyle>;

    /**
     * The character to use for truncating cell content
     */
    truncate?: string;
    /**
     * Whether to word wrap cell content by default.
     */
    wordWrap?: boolean;
}
