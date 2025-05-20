/** Sixel character: Introduces a color definition or selection. */
export const COLOR_INTRODUCER = "#";

/** Sixel character: Introduces a repeat sequence (Run-Length Encoding). */
export const REPEAT_INTRODUCER = "!";

/** Sixel character: Moves to the next Sixel line (typically 6 scanlines down). */
export const LINE_BREAK = "-";

/** Sixel character: Moves to the beginning of the current Sixel line (carriage return). */
export const CARRIAGE_RETURN = "$";

/** Sixel character: Start of a raster attribute definition. */
export const RASTER_ATTRIBUTE = '"';

/** First Sixel pixel data character ('?' = 0b000000). */
export const SIXEL_CHAR_OFFSET = "?".charCodeAt(0); // 63

/** Last Sixel pixel data character ('~' = 0b111111). */
export const SIXEL_CHAR_MAX = "~".charCodeAt(0); // 126
