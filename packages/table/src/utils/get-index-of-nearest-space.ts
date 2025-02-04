/** Finds the index of the nearest space character to a target position. */
export const getIndexOfNearestSpace = (text: string, targetIndex: number, searchRight = false): number => {
    if (text.charAt(targetIndex) === " ") {
        return targetIndex;
    }

    const direction = searchRight ? 1 : -1;

    for (let offset = 0; offset <= 3; offset++) {
        const pos = targetIndex + offset * direction;
        if (text.charAt(pos) === " ") {
            return pos;
        }
    }

    return targetIndex;
};
