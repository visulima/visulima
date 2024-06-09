import { TRUNCATOR } from "../constants";
import type { Inspect, Options } from "../types";

const inspectList = (
    list: ArrayLike<unknown>,
    options: Options,
    inspectItem?: Inspect,
    separator = ", ",
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string => {
    // eslint-disable-next-line no-param-reassign
    inspectItem = inspectItem ?? options.inspect;

    const size = list.length;

    if (size === 0) {
        return "";
    }

    const originalLength = options.truncate;

    let output = "";
    let peek = "";
    let truncated = "";

    // eslint-disable-next-line no-loops/no-loops
    for (let index = 0; index < size; index += 1) {
        const last = index + 1 === list.length;
        const secondToLast = index + 2 === list.length;

        truncated = `${TRUNCATOR}(${list.length - index})`;

        // eslint-disable-next-line security/detect-object-injection
        const value = list[index];

        // If there is more than one remaining we need to account for a separator of `, `
        // eslint-disable-next-line no-param-reassign
        options.truncate = originalLength - output.length - (last ? 0 : separator.length);

        const string = peek || inspectItem(value, options) + (last ? "" : separator);
        const nextLength = output.length + string.length;
        const truncatedLength = nextLength + truncated.length;

        // If this is the last element, and adding it would
        // take us over length, but adding the truncator wouldn't - then break now
        if (last && nextLength > originalLength && output.length + truncated.length <= originalLength) {
            break;
        }

        // If this isn't the last or second to last element to scan,
        // but the string is already over length then break here
        if (!last && !secondToLast && truncatedLength > originalLength) {
            break;
        }

        // Peek at the next string to determine if we should
        // break early before adding this item to the output
        peek = last ? "" : inspectItem(list[index + 1], options) + (secondToLast ? "" : separator);

        // If we have one element left, but this element and
        // the next takes over length, the break early
        if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
            break;
        }

        output += string;

        // If the next element takes us to length -
        // but there are more after that, then we should truncate now
        if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
            truncated = `${TRUNCATOR}(${list.length - index - 1})`;

            break;
        }

        truncated = "";
    }

    return `${output}${truncated}`;
}

export default inspectList;
