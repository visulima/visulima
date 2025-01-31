import type { BorderStyle } from "./types";

/**
 * Default border style using simple ASCII characters.
 */
export const DEFAULT_BORDER: BorderStyle = {
    bodyJoin: "│",
    bodyLeft: "│",
    bodyRight: "│",
    bottomBody: "─",
    bottomJoin: "┴",
    bottomLeft: "└",
    bottomRight: "┘",
    joinBody: "─",
    joinJoin: "┼",
    joinLeft: "├",
    joinRight: "┤",
    topBody: "─",
    topJoin: "┬",
    topLeft: "┌",
    topRight: "┐",
};

/**
 * Minimal border style using only horizontal lines.
 */
export const MINIMAL_BORDER: BorderStyle = {
    bodyJoin: "",
    bodyLeft: "",
    bodyRight: "",
    bottomBody: "-",
    bottomJoin: "-",
    bottomLeft: "-",
    bottomRight: "-",
    joinBody: "-",
    joinJoin: "-",
    joinLeft: "-",
    joinRight: "-",
    topBody: "-",
    topJoin: "-",
    topLeft: "-",
    topRight: "-",
};

/**
 * Double-line border style using Unicode box-drawing characters.
 */
export const DOUBLE_BORDER: BorderStyle = {
    bodyJoin: "║",
    bodyLeft: "║",
    bodyRight: "║",
    bottomBody: "═",
    bottomJoin: "╩",
    bottomLeft: "╚",
    bottomRight: "╝",
    joinBody: "═",
    joinJoin: "╬",
    joinLeft: "╠",
    joinRight: "╣",
    topBody: "═",
    topJoin: "╦",
    topLeft: "╔",
    topRight: "╗",
};

/**
 * Border style with rounded corners using Unicode box-drawing characters.
 */
export const ROUNDED_BORDER: BorderStyle = {
    bodyJoin: "│",
    bodyLeft: "│",
    bodyRight: "│",
    bottomBody: "─",
    bottomJoin: "┴",
    bottomLeft: "╰",
    bottomRight: "╯",
    joinBody: "─",
    joinJoin: "┼",
    joinLeft: "├",
    joinRight: "┤",
    topBody: "─",
    topJoin: "┬",
    topLeft: "╭",
    topRight: "╮",
};

/**
 * Border style using dots for the border.
 */
export const DOTS_BORDER: BorderStyle = {
    bodyJoin: "┊",
    bodyLeft: "┊",
    bodyRight: "┊",
    bottomBody: "┈",
    bottomJoin: "┴",
    bottomLeft: "└",
    bottomRight: "┘",
    joinBody: "┈",
    joinJoin: "┼",
    joinLeft: "├",
    joinRight: "┤",
    topBody: "┈",
    topJoin: "┬",
    topLeft: "┌",
    topRight: "┐",
};

/**
 * Border style using Markdown syntax.
 */
export const MARKDOWN_BORDER: BorderStyle = {
    bodyJoin: "|",
    bodyLeft: "|",
    bodyRight: "|",
    bottomBody: "-",
    bottomJoin: "|",
    bottomLeft: "|",
    bottomRight: "|",
    joinBody: "-",
    joinJoin: "|",
    joinLeft: "|",
    joinRight: "|",
    topBody: "-",
    topJoin: "|",
    topLeft: "|",
    topRight: "|",
};

/**
 * ASCII border style using only ASCII characters.
 */
export const ASCII_BORDER: BorderStyle = {
    bodyJoin: "|",
    bodyLeft: "|",
    bodyRight: "|",
    bottomBody: "-",
    bottomJoin: "+",
    bottomLeft: "+",
    bottomRight: "+",
    joinBody: "-",
    joinJoin: "+",
    joinLeft: "+",
    joinRight: "+",
    topBody: "-",
    topJoin: "+",
    topLeft: "+",
    topRight: "+",
};

/**
 * No border style.
 */
export const NO_BORDER: BorderStyle = {
    bodyJoin: "",
    bodyLeft: "",
    bodyRight: "",
    bottomBody: "",
    bottomJoin: "",
    bottomLeft: "",
    bottomRight: "",
    joinBody: "",
    joinJoin: "",
    joinLeft: "",
    joinRight: "",
    topBody: "",
    topJoin: "",
    topLeft: "",
    topRight: "",
};
