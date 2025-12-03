/**
 * Modified copy of https://github.com/chalk/chalk-template/blob/main/index.js
 *
 * MIT License
 *
 * Copyright (c) Josh Junon
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

const ESCAPES = new Map([
    ["0", "\0"],
    ["\\", "\\"],
    ["a", "\u0007"],
    ["b", "\b"],
    ["e", "\u001B"],
    ["f", "\f"],
    ["n", "\n"],
    ["r", "\r"],
    ["t", "\t"],
    ["v", "\v"],
]);

export const unescape = (c: string): string => {
    const u = c.startsWith("u");
    const bracket = c[1] === "{";

    if ((u && !bracket && c.length === 5) || (c.startsWith("x") && c.length === 3)) {
        return String.fromCodePoint(Number.parseInt(c.slice(1), 16));
    }

    if (u && bracket) {
        return String.fromCodePoint(Number.parseInt(c.slice(2, -1), 16));
    }

    return ESCAPES.get(c) ?? c;
};
