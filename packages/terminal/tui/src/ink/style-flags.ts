/**
 * Bitmask constants for text formatting flags used by StyledLine.
 *
 * These map 1:1 to SGR (Select Graphic Rendition) attributes and are stored
 * in the `formatFlags` field of StyleSpan objects. The FULL_WIDTH_MASK is
 * also used in StyledLine.charData entries (bit 15 / 0x8000 of Uint16Array).
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 */

/* eslint-disable no-bitwise */

export const BOLD_MASK = 1; // 0b0000_0001
export const DIM_MASK = 1 << 1; // 0b0000_0010
export const ITALIC_MASK = 1 << 2; // 0b0000_0100
export const UNDERLINE_MASK = 1 << 3; // 0b0000_1000
export const STRIKETHROUGH_MASK = 1 << 4; // 0b0001_0000
export const INVERSE_MASK = 1 << 5; // 0b0010_0000
export const HIDDEN_MASK = 1 << 6; // 0b0100_0000
export const FULL_WIDTH_MASK = 1 << 7; // 0b1000_0000
