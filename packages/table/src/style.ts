import type { BorderStyle } from "./types";

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

export const MINIMAL_BORDER: BorderStyle = {
    bodyJoin: "│",
    bodyLeft: "│",
    bodyRight: "│",
    bottomBody: "─",

    bottomJoin: "┴",
    bottomLeft: "└",
    bottomRight: "┘",
    joinBody: "",

    joinJoin: "",
    joinLeft: "",
    joinRight: "",

    topBody: "─",
    topJoin: "┬",
    topLeft: "┌",
    topRight: "┐",
};

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

export const DOTS_BORDER: BorderStyle = {
    bodyJoin: "⠇",
    bodyLeft: "⠇",
    bodyRight: "⠸",
    bottomBody: "⠂",

    bottomJoin: "⠒",
    bottomLeft: "⠓",
    bottomRight: "⠚",
    joinBody: "⠂",

    joinJoin: "⠿",
    joinLeft: "⠧",
    joinRight: "⠼",

    topBody: "⠂",
    topJoin: "⠒",
    topLeft: "⠋",
    topRight: "⠙",
};
