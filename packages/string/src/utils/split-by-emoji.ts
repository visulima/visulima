import { RE_EMOJI } from "../constants";

/**
 * Split text by emoji characters
 *
 * @param text - The text to split by emoji characters
 * @returns An array of string segments, with emoji characters as separate segments
 */
const splitByEmoji = (text: string): string[] => {
    const segments: string[] = [];

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    RE_EMOJI.lastIndex = 0;

    // eslint-disable-next-line no-loops/no-loops,no-cond-assign
    while ((match = RE_EMOJI.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push(text.slice(lastIndex, match.index));
        }

        segments.push(match[0]);

        lastIndex = RE_EMOJI.lastIndex;
    }

    if (lastIndex < text.length) {
        segments.push(text.slice(lastIndex));
    }

    return segments.filter(Boolean);
};

export default splitByEmoji;
