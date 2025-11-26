import type { Priority } from "../types";

/**
 * Compares two priority levels and returns a number indicating their relative order.
 * High priority is considered greater than normal, which is greater than low.
 * @example Sorting priorities
 * ```ts
 * const priorities: Priority[] = ["normal", "low", "high"];
 * priorities.sort(comparePriority);
 * // ["high", "normal", "low"]
 * ```
 * @param a The first priority to compare
 * @param b The second priority to compare
 * @returns A negative number if a is less than b, a positive number if a is greater than b, and zero if they are equal
 */
const comparePriority = (a: Priority, b: Priority): number => {
    if (a === b) {
        return 0;
    }

    if (a === "high") {
        return -1;
    }

    if (b === "high") {
        return 1;
    }

    if (a === "low") {
        return 1;
    }

    return -1;
};

export default comparePriority;
