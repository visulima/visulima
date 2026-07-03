/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/utils.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

/**
 * Clamp a number within the inclusive range specified by min and max.
 * The ternary operator is a tick quicker than Math.min(Math.max(num, min), max).
 */
// eslint-disable-next-line import/prefer-default-export -- public API uses named export
export const clamp = (number_: number, min: number, max: number): number => {
    if (min > number_) {
        return min;
    }

    return Math.min(number_, max);
};
