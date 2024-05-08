/**
 * When a match doesn't continue to the end of the string, this function rolls back to try again with the rest of the string
 *
 * @param {string[]} rollbackStrings The list of substrings that appeared prior to the current match
 * @param {string[]} patternSubstrings The matching list of pattens that need to be matched before the current pattern
 *
 * @returns {boolean} True if the match was successful, false if it was not
 */
const checkRollbackStrings = (rollbackStrings: string[], patternSubstrings: string[]): boolean => {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of,no-loops/no-loops
    for (let s = 0; s < rollbackStrings.length; ++s) {
        let currentString = rollbackStrings[s].string; // starting with the rolled back string
        let patternIndex = rollbackStrings[s].index;

        // eslint-disable-next-line no-loops/no-loops
        while (patternIndex < patternSubstrings.length) {
            if (!currentString.includes(patternSubstrings[patternIndex])) {
                break;
            }

            const testString = currentString.slice(1); // remove just one char to retest

            rollbackStrings.push({ index: patternIndex, string: testString });

            if (!testString.includes(patternSubstrings[patternIndex])) {
                rollbackStrings.pop();
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            currentString = currentString.slice(currentString.indexOf(patternSubstrings[patternIndex]) + patternSubstrings[patternIndex].length);

            // eslint-disable-next-line no-plusplus
            patternIndex++;

            // eslint-disable-next-line no-loops/no-loops,@typescript-eslint/no-unsafe-member-access
            while (patternSubstrings[patternIndex] === "") {
                // eslint-disable-next-line no-plusplus
                patternIndex++;
            }

            if (patternIndex >= patternSubstrings.length) {
                if (patternSubstrings.at(-1) !== "" && currentString.length > 0) {
                    // not ending with a wildcard, we need to backtrack
                    break;
                } else {
                    return true;
                }
            }
        }
    }

    return false;
};

const wildcard = (
    string_: string,
    pattern: string,
    options?: { caseSensitive?: boolean; wildcard?: string },
    // eslint-disable-next-line sonarjs/cognitive-complexity
): boolean => {
    // eslint-disable-next-line no-param-reassign
    options = { caseSensitive: true, wildcard: "*", ...options };

    if (!options.caseSensitive) {
        // eslint-disable-next-line no-param-reassign
        pattern = pattern.toLowerCase();
        // eslint-disable-next-line no-param-reassign
        string_ = string_.toLowerCase();
    }

    // if there are no wildcards, must be exact
    if (!pattern.includes(options.wildcard as string)) {
        return pattern === string_;
    }

    const patternSubstrings = pattern.split(options.wildcard as string);

    let patternIndex = 0;
    let currentString = string_;

    // find pattern beginning
    // eslint-disable-next-line no-loops/no-loops
    while (patternSubstrings[patternIndex] === "") {
        // eslint-disable-next-line no-plusplus
        patternIndex++;
        // if the pattern is just wildcards, it matches
        if (patternIndex === pattern.length) {
            return true;
        }
    }

    if (patternIndex === 0 && !string_.startsWith(patternSubstrings[0])) {
        // not starting with a wildcard
        return false;
    }

    const rollbackStrings = [];

    // eslint-disable-next-line no-loops/no-loops
    while (patternIndex < patternSubstrings.length) {
        // eslint-disable-next-line security/detect-object-injection
        if (!currentString.includes(patternSubstrings[patternIndex])) {
            return checkRollbackStrings(rollbackStrings, patternSubstrings);
        }

        // create a queue of strings to roll back and try again if we fail later
        const testString = currentString.slice(1); // remove just one char to retest

        rollbackStrings.push({ index: patternIndex, string: testString });

        // eslint-disable-next-line security/detect-object-injection
        if (!testString.includes(patternSubstrings[patternIndex])) {
            rollbackStrings.pop();
        }

        currentString = currentString.slice(currentString.indexOf(patternSubstrings[patternIndex]) + patternSubstrings[patternIndex].length);

        // eslint-disable-next-line no-plusplus
        patternIndex++;

        // eslint-disable-next-line no-loops/no-loops
        while (patternSubstrings[patternIndex] === "") {
            // eslint-disable-next-line no-plusplus
            patternIndex++;
        }
    }

    if (patternIndex >= patternSubstrings.length && patternSubstrings.at(-1) !== "" && currentString.length > 0) {
        // not ending with a wildcard, we need to backtrack
        if (currentString === string_) {
            // this string doesn't even match a little
            return false;
        }

        return checkRollbackStrings(rollbackStrings, patternSubstrings);
    }

    return true;
};

export default wildcard;
