import type AnsiStateTracker from "./ansi-state-tracker";

/**
 * Represents a segment of text with its ANSI state
 */
export interface AnsiSegment {
    /**
     * Whether this segment is an ANSI escape sequence
     */
    isEscapeSequence: boolean;

    /**
     * Whether this segment is a complete grapheme cluster
     */
    isGrapheme: boolean;

    /**
     * The text content of the segment
     */
    text: string;

    /**
     * Visual width of the segment
     */
    width: number;
}

/**
 * Represents a segment of text with its hyperlink state
 */
export interface HyperlinkSegment extends Omit<AnsiSegment, "text"> {
    /**
     * The URL of the hyperlink if this segment is part of one
     */
    hyperlinkUrl?: string;

    /**
     * Whether this segment is part of a hyperlink
     */
    isHyperlink?: boolean;

    /**
     * Whether this segment ends a hyperlink
     */
    isHyperlinkEnd?: boolean;

    /**
     * Whether this segment starts a hyperlink
     */
    isHyperlinkStart?: boolean;

    /**
     * The text content of the segment
     */
    text?: string;
}

/**
 * Options for processing ANSI strings
 */
export interface ProcessAnsiStringOptions {
    /**
     * Function to get the width of a character or grapheme cluster
     * @param text - The text to measure
     * @returns The visual width
     */
    getWidth?: (text: string) => number;

    /**
     * Function to process each ANSI escape sequence
     * @param sequence - The ANSI sequence
     * @param stateTracker - The ANSI state tracker
     * @returns Whether to continue processing or not
     */
    onEscapeSequence?: (sequence: string, stateTracker: AnsiStateTracker) => boolean | undefined;

    /**
     * Function to process each grapheme cluster
     * @param grapheme - The grapheme cluster
     * @param width - Visual width of the grapheme
     * @param stateTracker - The ANSI state tracker
     * @returns Whether to continue processing or not
     */
    onGrapheme?: (grapheme: string, width: number, stateTracker: AnsiStateTracker) => boolean | undefined;

    /**
     * Function to process each character segment
     * @param segment - The segment to process
     * @param stateTracker - The ANSI state tracker
     * @returns Whether to continue processing or not
     */
    onSegment?: (segment: AnsiSegment | HyperlinkSegment, stateTracker: AnsiStateTracker) => boolean | undefined;
}
