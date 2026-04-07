import { RE_FAST_ANSI } from "../../constants";

/**
 * Joins segments with a joiner, handling ANSI sequences and emojis correctly.
 * @param segments Array of segments to join
 * @param joiner String used to join segments together
 * @returns Joined string with proper handling of ANSI and emoji sequences
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const joinSegments = (segments: string[], joiner: string): string => {
    const { length } = segments;

    if (length === 0) {
        return "";
    }

    if (length === 1) {
        return segments[0] as string;
    }

    const result: string[] = [];

    let ansiStart = "";
    let currentContent = "";

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < length; index++) {
        const segment = segments[index] as string;

        if (RE_FAST_ANSI.test(segment)) {
            if (ansiStart) {
                // End of ANSI sequence
                result.push(ansiStart + currentContent + segment);
                ansiStart = "";
                currentContent = "";
            } else {
                // Start of ANSI sequence
                if (result.length > 0) {
                    result.push(joiner);
                }

                ansiStart = segment;
            }

            continue;
        }

        if (ansiStart) {
            // Inside ANSI sequence
            if (currentContent) {
                currentContent += joiner;
            }

            currentContent += segment;
        } else {
            // Outside ANSI sequence
            if (result.length > 0) {
                result.push(joiner);
            }

            result.push(segment);
        }
    }

    return result.join("");
};

export default joinSegments;
