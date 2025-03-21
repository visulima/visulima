import { RE_FAST_ANSI } from "../../constants";

/**
 * Joins segments with a joiner, handling ANSI sequences and emojis correctly
 *
 * @param segments - Array of segments to join
 * @param options - Join options
 * @returns Joined string with proper handling of ANSI and emoji sequences
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const joinSegments = <T extends string = string>(segments: string[], joiner: string): T => {
    const { length } = segments;

    if (length === 0) {
        return "" as T;
    }

    if (length === 1) {
        return segments[0] as T;
    }

    const result: string[] = [];

    let ansiStart = "";
    let currentContent = "";

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < length; index++) {
        // eslint-disable-next-line security/detect-object-injection
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

            // eslint-disable-next-line no-continue
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

    return result.join("") as T;
};

export default joinSegments;
