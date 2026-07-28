/**
 * Narrow the remaining path tails to those still relevant one level below `key`.
 *
 * A tail stays alive when its first segment matches `key` (or is a `*`
 * wildcard); the matched segment is then dropped so the child receives the
 * remainder. An empty resulting tail marks the child as fully matched.
 * @param tails The remaining path tails at the current node.
 * @param key The concrete child key being descended into.
 * @returns The tails that still apply below `key`.
 */
const narrow = (tails: ReadonlyArray<ReadonlyArray<string>>, key: string): ReadonlyArray<string>[] => {
    const next: ReadonlyArray<string>[] = [];

    for (const tail of tails) {
        const [head] = tail;

        if (head === "*" || head === key) {
            next.push(tail.slice(1));
        }
    }

    return next;
};

export default narrow;
