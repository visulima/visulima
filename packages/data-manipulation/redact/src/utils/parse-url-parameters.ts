/**
 * Copied from https://github.com/zjullion/sensitive-param-filter/blob/master/src/helpers.ts
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Alberta Motor Association
 * Copyright (c) 2024 Zach Jullion
 */
// See https://tools.ietf.org/html/rfc1738#section-2.2 and https://tools.ietf.org/html/rfc3986#section-2.2
const urlDelimiters = "#;/?:@&";
// eslint-disable-next-line @rushstack/security/no-unsafe-regexp
const urlParameterRegex = new RegExp(String.raw`([${urlDelimiters}][^${urlDelimiters}=\s]+=[^${urlDelimiters}=\s]*)`, "g");

const parseUrlParameters = (input: string): { key: string | null; value: string }[] => {
    const segments = [];

    let previousEndIndex = 0;

    urlParameterRegex.lastIndex = 0;

    let match = urlParameterRegex.exec(input);

    while (match != undefined) {
        const { 0: text, index } = match;

        segments.push({
            key: null,
            value: input.slice(previousEndIndex, index + 1),
        });

        previousEndIndex = index + text.length;

        segments.push({
            key: text.slice(1, text.indexOf("=")),
            value: text.slice(text.indexOf("=") + 1),
        });

        match = urlParameterRegex.exec(input);
    }

    const lastSegment = input.slice(previousEndIndex);

    if (lastSegment.length > 0) {
        segments.push({
            key: null,
            value: lastSegment,
        });
    }

    return segments;
};

export default parseUrlParameters;
