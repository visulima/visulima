const binarySearch = (element: number, array: number[]): number => {
    let m = 0;
    let n = array.length - 2;

    while (m < n) {
        // eslint-disable-next-line no-bitwise
        const key = m + ((n - m) >> 1);

        if (element < (array[key] as number)) {
            n = key - 1;
        } else if (element >= (array[key + 1] as number)) {
            m = key + 1;
        } else {
            m = key;
            break;
        }
    }

    return m;
};

// split by line break characters, CR, LF or CRLF
// compile an array of indexes, where each line starts
const getLineStartIndexes = (string_: string): number[] =>
    // eslint-disable-next-line unicorn/no-array-reduce
    string_.split(/\n|\r(?!\n)/).reduce(
        (accumulator: number[], current) => {
            accumulator.push((accumulator.at(-1) as number) + current.length + 1);

            return accumulator;
        },
        [0],
    );

const indexToLineColumn = (
    input: number[] | string,
    index: number,
    options?: {
        skipChecks: boolean;
    },
): {
    column: number;
    line: number;
} => {
    const skipChecks = options?.skipChecks ?? false;

    if (!skipChecks && ((!Array.isArray(input) && typeof input !== "string") || ((typeof input === "string" || Array.isArray(input)) && input.length === 0))) {
        return { column: 0, line: 0 };
    }

    if (
        !skipChecks
        && (typeof index !== "number" || (typeof input === "string" && index >= input.length) || (Array.isArray(input) && index + 1 >= (input.at(-1) as number)))
    ) {
        return { column: 0, line: 0 };
    }

    // it depends, pre-cached input was given or a string
    if (typeof input === "string") {
        // not cached - calculate the line start indexes
        const startIndexesOfEachLine = getLineStartIndexes(input);
        const line = binarySearch(index, startIndexesOfEachLine);

        return {
            column: index - (startIndexesOfEachLine[line] as number) + 1,
            line: line + 1,
        };
    }

    // ELSE - cached line start indexes - we don't even need the string source!
    const line = binarySearch(index, input);

    return {
        column: index - (input[line] as number) + 1,
        line: line + 1,
    };
};

export default indexToLineColumn;
