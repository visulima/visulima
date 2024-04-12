// match[0] = full match
// match[1] = visible text
// match[2] = relevant escape code
// match[3] = skippable escape code
// eslint-disable-next-line no-control-regex,regexp/no-control-character
const ANSI_SEQUENCE = /^(.*?)(?:(\u001B\[[^m]+m|\u001B\]8;;.*?(?:\u001B\\|\u0007))|(\u001B\[\?\d+[a-zA-Z]))/;

// eslint-disable-next-line compat/compat
const segmenter = new Intl.Segmenter(`en`, { granularity: `grapheme` });

const slice = (
    orig: string,
    at?: number,
    until?: number,
): {
    slice: string;
    visible: number;
} => {
    if (at === undefined) {
        // eslint-disable-next-line no-param-reassign
        at = 0;
    }

    if (until === undefined) {
        // eslint-disable-next-line no-param-reassign
        until = orig.length;
    }

    // Because to do this we'd need to know the printable length of the string,
    // which would require to do two passes (or would complexify the main one)
    if (at < 0 || until < 0) {
        throw new RangeError(`Negative indices aren't supported by this implementation`);
    }

    const length = until - at;

    let result = ``;

    let skipped = 0;
    let visible = 0;

    // eslint-disable-next-line no-loops/no-loops
    while (orig.length > 0) {
        const lookup = (ANSI_SEQUENCE.exec(orig)) ?? [orig, orig, undefined];

        let graphemes = Array.from(segmenter.segment(lookup[1]), (entry) => entry.segment);

        const skipping = Math.min(at - skipped, graphemes.length);

        graphemes = graphemes.slice(skipping);

        const displaying = Math.min(length - visible, graphemes.length);

        result += graphemes.slice(0, displaying).join(``);

        skipped += skipping;
        visible += displaying;

        if (typeof lookup[2] !== `undefined`) {
            result += lookup[2];
        }

        // eslint-disable-next-line no-param-reassign
        orig = orig.slice(lookup[0].length);
    }

    return { slice: result, visible };
};

export default slice;
