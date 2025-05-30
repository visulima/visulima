import { TRUNCATOR } from "../constants";
import type { InternalInspect, Options } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InspectItem = (value: any, object: any, options: Options, inspect: InternalInspect) => string;

const inspectList = (
    list: ArrayLike<unknown>,
    from: unknown,
    options: Options,
    inspect: InternalInspect,
    inspectItem?: InspectItem,
    separator = ", ",
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string => {
    const size = list.length;

    if (size === 0) {
        return "";
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    let inspect_: InspectItem | InternalInspect = inspect;

    if (inspectItem !== undefined) {
        inspect_ = inspectItem;
    }

    const originalLength = options.truncate;

    let output = "";
    let peek = "";
    let truncated = "";

    for (let index = 0; index < size; index += 1) {
        const last = index + 1 === list.length;
        const secondToLast = index + 2 === list.length;

        truncated = `${TRUNCATOR}(${list.length - index})`;

        let value = list[index];

        // If there is more than one remaining we need to account for a separator of `, `
        // eslint-disable-next-line no-param-reassign
        options.truncate = originalLength - output.length - (last ? 0 : separator.length);

        const string = peek || inspect_(value, from, options, inspect) + (last ? "" : separator);
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

        value = list[index + 1];

        // Peek at the next string to determine if we should
        // break early before adding this item to the output
        peek = last ? "" : inspect_(value, from, options, inspect) + (secondToLast ? "" : separator);

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
};

export default inspectList;
