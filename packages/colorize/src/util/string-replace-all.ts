/**
 * Modified copy of https://github.com/webdiscus/ansis/blob/master/src/utils.js
 *
 * ISC License
 *
 * Copyright (c) 2023, webdiscus
 */

/**
 * Replace all matched strings.
 * Note: this implementation is over 30% faster than String.replaceAll().
 */
export const stringReplaceAll = (string_: string, searchValue: string, replaceValue: string): string => {
    // visible style has empty open/close props
    if (searchValue === "") {
        return string_;
    }

    let pos = string_.indexOf(searchValue);

    if (pos < 0) {
        return string_;
    }

    const substringLength = searchValue.length;
    let lastPos = 0;
    let result = "";

    // eslint-disable-next-line no-loops/no-loops,no-bitwise
    while (~pos) {
        result += string_.slice(lastPos, pos) + replaceValue;
        lastPos = pos + substringLength;
        pos = string_.indexOf(searchValue, lastPos);
    }

    return result + string_.slice(lastPos);
};
