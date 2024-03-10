// Prevent `String#lastIndexOf` treat negative index as `0`
const safeLastIndexOf = (string_: string, searchString: string, index: number) => (index < 0 ? -1 : string_.lastIndexOf(searchString, index));

const indexToPosition = (
    text: string,
    textIndex: number,
): {
    column: number;
    line: number;
} => {
    if (textIndex < 0 || text === "") {
        return { column: 0, line: 1 };
    }

    if (textIndex >= text.length) {
        throw new Error("Index out of bounds");
    }

    const lineBreakBefore = safeLastIndexOf(text, "\n", textIndex - 1);

    const column = textIndex - lineBreakBefore - 1;

    let line = 0;

    // eslint-disable-next-line no-loops/no-loops
    for (let index = lineBreakBefore; index >= 0; index = safeLastIndexOf(text, "\n", index - 1)) {
        // eslint-disable-next-line no-plusplus
        line++;
    }

    return { column, line };
};

export default indexToPosition;
