export const stepize = <T>(start: T, end: T, steps: number): T => {
    const step: T = {};

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const k in start) {
        if (Object.prototype.hasOwnProperty.call(start, k)) {
            step[k] = steps === 0 ? 0 : (end[k]! - start[k]!) / steps;
        }
    }

    return step;
}
