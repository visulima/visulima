import type { BorderStyle } from './index';

export const DEFAULT_BORDER: BorderStyle = {
    topBody: '─',
    topJoin: '┬',
    topLeft: '┌',
    topRight: '┐',

    bottomBody: '─',
    bottomJoin: '┴',
    bottomLeft: '└',
    bottomRight: '┘',

    bodyLeft: '│',
    bodyRight: '│',
    bodyJoin: '│',

    joinBody: '─',
    joinLeft: '├',
    joinRight: '┤',
    joinJoin: '┼',
};

export const HEAVY_BORDER: BorderStyle = {
    topBody: '═',
    topJoin: '╦',
    topLeft: '╔',
    topRight: '╗',

    bottomBody: '═',
    bottomJoin: '╩',
    bottomLeft: '╚',
    bottomRight: '╝',

    bodyLeft: '║',
    bodyRight: '║',
    bodyJoin: '║',

    joinBody: '═',
    joinLeft: '╠',
    joinRight: '╣',
    joinJoin: '╬',
};

export const ROUNDED_BORDER: BorderStyle = {
    topBody: '─',
    topJoin: '┬',
    topLeft: '╭',
    topRight: '╮',

    bottomBody: '─',
    bottomJoin: '┴',
    bottomLeft: '╰',
    bottomRight: '╯',

    bodyLeft: '│',
    bodyRight: '│',
    bodyJoin: '│',

    joinBody: '─',
    joinLeft: '├',
    joinRight: '┤',
    joinJoin: '┼',
};

export const DOUBLE_BORDER: BorderStyle = {
    topBody: '═',
    topJoin: '╦',
    topLeft: '╔',
    topRight: '╗',

    bottomBody: '═',
    bottomJoin: '╩',
    bottomLeft: '╚',
    bottomRight: '╝',

    bodyLeft: '║',
    bodyRight: '║',
    bodyJoin: '║',

    joinBody: '═',
    joinLeft: '╠',
    joinRight: '╣',
    joinJoin: '╬',
};

export const MINIMAL_BORDER: BorderStyle = {
    topBody: '─',
    topJoin: '┬',
    topLeft: '┌',
    topRight: '┐',

    bottomBody: '─',
    bottomJoin: '┴',
    bottomLeft: '└',
    bottomRight: '┘',

    bodyLeft: '│',
    bodyRight: '│',
    bodyJoin: '│',

    joinBody: '─',
    joinLeft: '├',
    joinRight: '┤',
    joinJoin: '┼',
};

export const ASCII_BORDER: BorderStyle = {
    topBody: '-',
    topJoin: '+',
    topLeft: '+',
    topRight: '+',

    bottomBody: '-',
    bottomJoin: '+',
    bottomLeft: '+',
    bottomRight: '+',

    bodyLeft: '|',
    bodyRight: '|',
    bodyJoin: '|',

    joinBody: '-',
    joinLeft: '+',
    joinRight: '+',
    joinJoin: '+',
};

export const MARKDOWN_BORDER: BorderStyle = {
    topBody: '-',
    topJoin: '|',
    topLeft: '|',
    topRight: '|',

    bottomBody: '-',
    bottomJoin: '|',
    bottomLeft: '|',
    bottomRight: '|',

    bodyLeft: '|',
    bodyRight: '|',
    bodyJoin: '|',

    joinBody: '-',
    joinLeft: '|',
    joinRight: '|',
    joinJoin: '|',
};

export const DOTS_BORDER: BorderStyle = {
    topBody: '⠂',
    topJoin: '⠒',
    topLeft: '⠋',
    topRight: '⠙',

    bottomBody: '⠂',
    bottomJoin: '⠒',
    bottomLeft: '⠓',
    bottomRight: '⠚',

    bodyLeft: '⠇',
    bodyRight: '⠸',
    bodyJoin: '⠇',

    joinBody: '⠂',
    joinLeft: '⠧',
    joinRight: '⠼',
    joinJoin: '⠿',
};
