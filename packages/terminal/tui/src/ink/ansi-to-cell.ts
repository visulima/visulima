/**
 * Sentinel value for the trailing cell of a wide (fullWidth) character.
 * Must be outside Unicode scalar range so it never collides with real text.
 */
export const CONTINUATION_CELL_CODE = 0x11_00_00;
