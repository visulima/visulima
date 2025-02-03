/**
 * Represents horizontal alignment options for table cells.
 */
export type HorizontalAlign = "center" | "left" | "right";

/**
 * Represents vertical alignment options for table cells.
 */
export type VerticalAlign = "bottom" | "middle" | "top";

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
export interface TruncateOptions {
    /**
     * The position to truncate the string.
     * @default 'end'
     */
    position?: "end" | "middle" | "start";

    /**
     * Truncate the string from a whitespace if it is within 3 characters from the actual breaking point.
     * @default false
     */
    preferTruncationOnSpace?: boolean;

    /**
     * Add a space between the text and the ellipsis.
     * @default false
     */
    space?: boolean;

    /**
     * The character to use at the breaking point.
     * @default '…'
     */
    truncationCharacter?: string;
}

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
     * Options for controlling how text is truncated when it exceeds maxWidth
     */
    truncate?: TruncateOptions;

    /**
     * Vertical alignment of the cell content.
     */
    vAlign?: VerticalAlign;

    /**
     * Whether to word wrap the cell content.
     */
    wordWrap?: boolean;
}

export type Cell = CellOptions | bigint | number | string | null | undefined;

/**
 * Defines the border style configuration for tables.
 */
export interface BorderStyle {
    /**
     * Character for joining body borders.
     */
    bodyJoin: string;
    /**
     * Character for the left border body.
     */
    bodyLeft: string;
    /**
     * Character for the right border body.
     */
    bodyRight: string;
    /**
     * Character for the bottom border body.
     */
    bottomBody: string;

    /**
     * Character for joining bottom borders.
     */
    bottomJoin: string;
    /**
     * Character for the bottom-left corner.
     */
    bottomLeft: string;
    /**
     * Character for the bottom-right corner.
     */
    bottomRight: string;
    /**
     * Character for the join body.
     */
    joinBody: string;

    /**
     * Character for joining.
     */
    joinJoin: string;
    /**
     * Character for the left join.
     */
    joinLeft: string;
    /**
     * Character for the right join.
     */
    joinRight: string;

    /**
     * Character for the top border body.
     */
    topBody: string;
    /**
     * Character for joining top borders.
     */
    topJoin: string;
    /**
     * Character for the top-left corner.
     */
    topLeft: string;
    /**
     * Character for the top-right corner.
     */
    topRight: string;
}

/**
 * Defines the style options for a table.
 */
export interface TableStyle {
    /**
     * Border style configuration.
     */
    border?: Partial<BorderStyle>;

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
export interface TableConstructorOptions {
    /**
     * Maximum width for all cells. Individual cell maxWidth will override this.
     */
    maxWidth?: number;

    /**
     * Whether to show the header of the table
     */
    showHeader?: boolean;

    /**
     * The style options for the table
     */
    style?: Partial<TableStyle>;

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
    wordWrap?: boolean;
}
