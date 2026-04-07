type RollbackString = { index: number; string: string };

/**
 * When a match doesn't continue to the end of the string, this function rolls back to try again with the rest of the string.
 * @param rollbackStrings The list of substrings that appeared prior to the current match
 * @param patternSubstrings The matching list of pattens that need to be matched before the current pattern
 * @returns True if the match was successful, false if it was not
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const checkRollbackStrings = (rollbackStrings: RollbackString[], patternSubstrings: string[]): boolean => {
    for (let s = 0; s < rollbackStrings.length; s += 1) {
        let currentString = (rollbackStrings[s] as RollbackString).string; // starting with the rolled back string
        let patternIndex = (rollbackStrings[s] as RollbackString).index;

        while (patternIndex < patternSubstrings.length) {
            const patternSubstring = patternSubstrings[patternIndex] as string;

            if (!currentString.includes(patternSubstring)) {
                break;
            }

            const testString = currentString.slice(1); // remove just one char to retest

            rollbackStrings.push({ index: patternIndex, string: testString });

            if (!testString.includes(patternSubstring)) {
                rollbackStrings.pop();
            }

            currentString = currentString.slice(currentString.indexOf(patternSubstring) + patternSubstring.length);

            patternIndex += 1;

            while (patternSubstrings[patternIndex] === "") {
                patternIndex += 1;
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

/**
 * If you put a wildcard at the beginning, for example *Thing then you can match anything or nothing before your string.
 *
 * So your string could be Best Thing or just Thing and it would match fine.
 * The same is true for the end. Best* would match Best Thing or just Best
 * If you want to match text in the middle of the string, it works the same way.
 * Best*Thing matches both BestThing and Best and crazy Thing.
 * @param input The input string to test
 * @param pattern The pattern with wildcards
 * @returns Whether the input matches the pattern
 */
const wildcard = (
    input: string,
    pattern: string,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): boolean => {
    // if there are no wildcards, must be exact
    if (!pattern.includes("*")) {
        return pattern === input;
    }

    const patternSubstrings = pattern.split("*");

    let patternIndex = 0;
    let currentString = input;

    // find pattern beginning
    while (patternSubstrings[patternIndex] === "") {
        patternIndex += 1;

        // if the pattern is just wildcards, it matches
        if (patternIndex === pattern.length) {
            return true;
        }
    }

    if (patternIndex === 0 && !input.startsWith(patternSubstrings[0] as string)) {
        // not starting with a wildcard
        return false;
    }

    const rollbackStrings: RollbackString[] = [];

    while (patternIndex < patternSubstrings.length) {
        const patternSubstring = patternSubstrings[patternIndex] as string;

        if (!currentString.includes(patternSubstring)) {
            return checkRollbackStrings(rollbackStrings, patternSubstrings);
        }

        // create a queue of strings to roll back and try again if we fail later
        const testString = currentString.slice(1); // remove just one char to retest

        rollbackStrings.push({ index: patternIndex, string: testString });

        if (!testString.includes(patternSubstring)) {
            rollbackStrings.pop();
        }

        currentString = currentString.slice(currentString.indexOf(patternSubstring) + patternSubstring.length);

        patternIndex += 1;

        while (patternSubstrings[patternIndex] === "") {
            patternIndex += 1;
        }
    }

    if (patternIndex >= patternSubstrings.length && patternSubstrings.at(-1) !== "" && currentString.length > 0) {
        // not ending with a wildcard, we need to backtrack
        if (currentString === input) {
            // this string doesn't even match a little
            return false;
        }

        return checkRollbackStrings(rollbackStrings, patternSubstrings);
    }

    return true;
};

export default wildcard;
