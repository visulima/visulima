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

    /**
     * Optional cap on the number of elements rendered. When the list is longer,
     * rendering stops early and an `… (N more)` marker is appended. Callers that
     * represent ordered collections (arrays, typed arrays, sets, maps) pass
     * `options.maxArrayLength`; property lists leave it `Infinity`.
     */
    maxLength = Number.POSITIVE_INFINITY,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string => {
    const fullSize = list.length;

    if (fullSize === 0) {
        return "";
    }

    // Apply the element-count cap before the character-truncation logic below so a
    // huge but short-stringifying array (e.g. 10k zeros) is still bounded.
    const capped = Number.isFinite(maxLength) && fullSize > maxLength;
    const size = capped ? Math.max(0, Math.floor(maxLength)) : fullSize;

    if (size === 0) {
        return `${TRUNCATOR}(${String(fullSize)})`;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    let inspect_: InspectItem | InternalInspect = inspect;

    if (inspectItem !== undefined) {
        inspect_ = inspectItem;
    }

    const originalLength = options.truncate;
    // Building the `…(N)` marker on every iteration allocates a throwaway string per
    // element. When character-truncation is disabled (the common path via pail) the
    // marker is never used, so skip the allocation entirely.
    const truncationEnabled = Number.isFinite(originalLength);

    let output = "";
    let peek = "";
    let truncated = "";

    for (let index = 0; index < size; index += 1) {
        const last = index + 1 === size;
        const secondToLast = index + 2 === size;

        if (truncationEnabled) {
            truncated = `${TRUNCATOR}(${String(size - index)})`;
        }

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
        const peekSuffix = secondToLast ? "" : separator;

        // eslint-disable-next-line unicorn/prefer-ternary
        if (last) {
            peek = "";
        } else {
            peek = inspect_(value, from, options, inspect) + peekSuffix;
        }

        // If we have one element left, but this element and
        // the next takes over length, the break early
        if (!last && secondToLast && truncatedLength > originalLength && nextLength + peek.length > originalLength) {
            break;
        }

        output += string;

        // If the next element takes us to length -
        // but there are more after that, then we should truncate now
        if (!last && !secondToLast && nextLength + peek.length >= originalLength) {
            truncated = `${TRUNCATOR}(${String(size - index - 1)})`;

            break;
        }

        truncated = "";
    }

    // If the loop rendered every element it was allowed to but the original list was
    // capped by `maxArrayLength`, surface how many elements were elided. Prefix the
    // entry `separator` so the marker is offset from the last element exactly like a
    // real entry (`1, 2, … 4 more`) instead of being glued on after a dropped comma.
    if (capped && truncated === "") {
        truncated = `${separator}${TRUNCATOR} ${String(fullSize - size)} more`;
    }

    return `${output}${truncated}`;
};

export default inspectList;
