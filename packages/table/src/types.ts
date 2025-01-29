export type HorizontalAlign = "center" | "left" | "right";
export type VerticalAlign = "bottom" | "middle" | "top";

export type Border = {
    body: string;
    left: string;
    middle: string;
    right: string;
};

export type CellOptions = {
    colSpan?: number;
    content: number | string | null | undefined;
    hAlign?: HorizontalAlign;
    rowSpan?: number;
    vAlign?: VerticalAlign;
};

export type Cell = CellOptions | number | string | null | undefined;

export type BorderStyle = {
    bodyJoin?: string;
    bodyLeft?: string;
    bodyRight?: string;
    bottomBody?: string;

    bottomJoin?: string;
    bottomLeft?: string;
    bottomRight?: string;
    joinBody?: string;

    joinJoin?: string;
    joinLeft?: string;
    joinRight?: string;

    topBody?: string;
    topJoin?: string;
    topLeft?: string;
    topRight?: string;
};

export type TableOptions = {
    /**
     * The default alignment of the cell content
     */
    align?: HorizontalAlign;
    /**
     * The style of the table borders
     */
    border?: BorderStyle;
    /**
     * Whether to draw the outer border of the table
     */
    drawOuterBorder?: boolean;
    /**
     * The character to use for empty cells
     */
    emptyCellChar?: string;
    /**
     * The maximum width of a cell before truncation
     */
    maxWidth?: number;
    /**
     * The padding between the cell content and the cell border
     */
    padding?: number;
    /**
     * Whether to show the header of the table
     */
    showHeader?: boolean;
    /**
     * Style options for specific parts of the table
     */
    style?: {
        cells?: string[];
        header?: string[];
    };
    /**
     * Whether to truncate cells that are too long
     */
    truncate?: boolean;
    /**
     * The default vertical alignment of the cell content
     */
    vAlign?: VerticalAlign;
};
