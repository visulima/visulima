// See https://tools.ietf.org/html/rfc1738#section-2.2 and https://tools.ietf.org/html/rfc3986#section-2.2
const urlDelimiters = "#;/?:@&";
const urlParameterRegex = new RegExp(`([${urlDelimiters}][^${urlDelimiters}=\\s]+=[^${urlDelimiters}=\\s]*)`, "g");

const parseUrlParameters = (input: string): { key: string | null; value: string }[] => {
    const segments = [];

    let previousEndIndex = 0;

    urlParameterRegex.lastIndex = 0;

    let match = urlParameterRegex.exec(input);


    while (match != null) {
        const { 0: text, index } = match;

        segments.push({
            key: null,
            value: input.slice(previousEndIndex, index + 1),
        });

        previousEndIndex = index + text.length;

        segments.push({
            key: text.slice(1, text.indexOf("=")),
            value: text.slice(text.indexOf("=") + 1, text.length),
        });

        match = urlParameterRegex.exec(input);
    }

    const lastSegment = input.slice(previousEndIndex, input.length);

    if (lastSegment.length > 0) {
        segments.push({
            key: null,
            value: lastSegment,
        });
    }

    return segments;
};

export default parseUrlParameters;
