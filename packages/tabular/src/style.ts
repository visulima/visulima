import type { BorderStyle } from "./types";

/**
 * Default border style using standard box-drawing characters.
 */
export const DEFAULT_BORDER: BorderStyle = {
    bodyJoin: { char: "│", width: 1 },
    bodyLeft: { char: "│", width: 1 },
    bodyRight: { char: "│", width: 1 },
    bottomBody: { char: "─", width: 1 },
    bottomJoin: { char: "┴", width: 1 },
    bottomLeft: { char: "└", width: 1 },
    bottomRight: { char: "┘", width: 1 },
    joinBody: { char: "─", width: 1 },
    joinJoin: { char: "┼", width: 1 },
    joinLeft: { char: "├", width: 1 },
    joinRight: { char: "┤", width: 1 },
    topBody: { char: "─", width: 1 },
    topJoin: { char: "┬", width: 1 },
    topLeft: { char: "┌", width: 1 },
    topRight: { char: "┐", width: 1 },
};

/**
 * Minimal border style using only horizontal lines.
 */
export const MINIMAL_BORDER: BorderStyle = {
    bodyJoin: { char: " ", width: 1 }, // Space for vertical
    bodyLeft: { char: " ", width: 1 }, // Space for vertical
    bodyRight: { char: " ", width: 1 }, // Space for vertical
    bottomBody: { char: "-", width: 1 },
    bottomJoin: { char: "-", width: 1 },
    bottomLeft: { char: "-", width: 1 },
    bottomRight: { char: "-", width: 1 },
    joinBody: { char: "-", width: 1 },
    joinJoin: { char: "-", width: 1 },
    joinLeft: { char: "-", width: 1 },
    joinRight: { char: "-", width: 1 },
    topBody: { char: "-", width: 1 },
    topJoin: { char: "-", width: 1 },
    topLeft: { char: "-", width: 1 },
    topRight: { char: "-", width: 1 },
};

/**
 * Double-line border style using Unicode box-drawing characters.
 */
export const DOUBLE_BORDER: BorderStyle = {
    bodyJoin: { char: "║", width: 1 },
    bodyLeft: { char: "║", width: 1 },
    bodyRight: { char: "║", width: 1 },
    bottomBody: { char: "═", width: 1 },
    bottomJoin: { char: "╩", width: 1 },
    bottomLeft: { char: "╚", width: 1 },
    bottomRight: { char: "╝", width: 1 },
    joinBody: { char: "═", width: 1 },
    joinJoin: { char: "╬", width: 1 },
    joinLeft: { char: "╠", width: 1 },
    joinRight: { char: "╣", width: 1 },
    topBody: { char: "═", width: 1 },
    topJoin: { char: "╦", width: 1 },
    topLeft: { char: "╔", width: 1 },
    topRight: { char: "╗", width: 1 },
};

/**
 * Border style with rounded corners using Unicode box-drawing characters.
 */
export const ROUNDED_BORDER: BorderStyle = {
    bodyJoin: { char: "│", width: 1 },
    bodyLeft: { char: "│", width: 1 },
    bodyRight: { char: "│", width: 1 },
    bottomBody: { char: "─", width: 1 },
    bottomJoin: { char: "┴", width: 1 },
    bottomLeft: { char: "╰", width: 1 },
    bottomRight: { char: "╯", width: 1 },
    joinBody: { char: "─", width: 1 },
    joinJoin: { char: "┼", width: 1 },
    joinLeft: { char: "├", width: 1 },
    joinRight: { char: "┤", width: 1 },
    topBody: { char: "─", width: 1 },
    topJoin: { char: "┬", width: 1 },
    topLeft: { char: "╭", width: 1 },
    topRight: { char: "╮", width: 1 },
};

/**
 * Border style using dots for the border.
 */
export const DOTS_BORDER: BorderStyle = {
    bodyJoin: { char: "┊", width: 1 },
    bodyLeft: { char: "┊", width: 1 },
    bodyRight: { char: "┊", width: 1 },
    bottomBody: { char: "┈", width: 1 },
    bottomJoin: { char: "┴", width: 1 },
    bottomLeft: { char: "└", width: 1 },
    bottomRight: { char: "┘", width: 1 },
    joinBody: { char: "┈", width: 1 },
    joinJoin: { char: "┼", width: 1 },
    joinLeft: { char: "├", width: 1 },
    joinRight: { char: "┤", width: 1 },
    topBody: { char: "┈", width: 1 },
    topJoin: { char: "┬", width: 1 },
    topLeft: { char: "┌", width: 1 },
    topRight: { char: "┐", width: 1 },
};

/**
 * Border style using Markdown syntax.
 */
export const MARKDOWN_BORDER: BorderStyle = {
    bodyJoin: { char: "|", width: 1 },
    bodyLeft: { char: "|", width: 1 },
    bodyRight: { char: "|", width: 1 },
    bottomBody: { char: "-", width: 1 },
    bottomJoin: { char: "|", width: 1 },
    bottomLeft: { char: "|", width: 1 },
    bottomRight: { char: "|", width: 1 },
    joinBody: { char: "-", width: 1 },
    joinJoin: { char: "|", width: 1 },
    joinLeft: { char: "|", width: 1 },
    joinRight: { char: "|", width: 1 },
    topBody: { char: "-", width: 1 },
    topJoin: { char: "|", width: 1 },
    topLeft: { char: "|", width: 1 },
    topRight: { char: "|", width: 1 },
};

/**
 * ASCII border style using only ASCII characters.
 */
export const ASCII_BORDER: BorderStyle = {
    bodyJoin: { char: "|", width: 1 },
    bodyLeft: { char: "|", width: 1 },
    bodyRight: { char: "|", width: 1 },
    bottomBody: { char: "-", width: 1 },
    bottomJoin: { char: "+", width: 1 },
    bottomLeft: { char: "+", width: 1 },
    bottomRight: { char: "+", width: 1 },
    joinBody: { char: "-", width: 1 },
    joinJoin: { char: "+", width: 1 },
    joinLeft: { char: "+", width: 1 },
    joinRight: { char: "+", width: 1 },
    topBody: { char: "-", width: 1 },
    topJoin: { char: "+", width: 1 },
    topLeft: { char: "+", width: 1 },
    topRight: { char: "+", width: 1 },
};

/**
 * No border style.
 */
export const NO_BORDER: BorderStyle = {
    bodyJoin: { char: "", width: 0 },
    bodyLeft: { char: "", width: 0 },
    bodyRight: { char: "", width: 0 },
    bottomBody: { char: "", width: 0 },
    bottomJoin: { char: "", width: 0 },
    bottomLeft: { char: "", width: 0 },
    bottomRight: { char: "", width: 0 },
    joinBody: { char: "", width: 0 },
    joinJoin: { char: "", width: 0 },
    joinLeft: { char: "", width: 0 },
    joinRight: { char: "", width: 0 },
    topBody: { char: "", width: 0 },
    topJoin: { char: "", width: 0 },
    topLeft: { char: "", width: 0 },
    topRight: { char: "", width: 0 },
};
