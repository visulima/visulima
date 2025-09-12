/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/utils.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

/**
 * Clamp a number within the inclusive range specified by min and max.
 * @note: The ternary operator is a tick quicker than Math.min(Math.max(num, min), max).
 */

export const clamp = (number_: number, min: number, max: number): number => (min > number_ ? min : Math.min(number_, max));
