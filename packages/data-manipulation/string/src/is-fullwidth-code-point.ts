/**
 * Inlined from https://github.com/sindresorhus/is-fullwidth-code-point
 * MIT License, Copyright (c) Sindre Sorhus (sindresorhus@gmail.com)
 */

// @ts-expect-error - private exports used by is-fullwidth-code-point
// eslint-disable-next-line import/no-extraneous-dependencies
import { _isFullWidth as isFullWidth, _isWide as isWide } from "get-east-asian-width";

/**
 * Check if the given code point is a fullwidth character.
 * @param codePoint The code point to check.
 * @returns Whether the code point is a fullwidth character.
 */
const isFullwidthCodePoint = (codePoint: number): boolean => {
    if (!Number.isInteger(codePoint)) {
        return false;
    }

    return (isFullWidth as (cp: number) => boolean)(codePoint) || (isWide as (cp: number) => boolean)(codePoint);
};

export default isFullwidthCodePoint;
