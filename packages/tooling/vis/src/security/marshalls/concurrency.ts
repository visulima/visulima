/**
 * Shared bounded-concurrency primitive used by every marshall and the
 * pipeline-level packument prefetch.
 *
 * Workers pull from a shared cursor so slow tasks never block fast ones
 * (unlike chunked `Promise.all` waves, which stall on the slowest task in
 * each chunk).
 */

/** Default in-flight task count for marshall fan-out. Tuned for npm/GitHub politeness. */
export const DEFAULT_MARSHALL_CONCURRENCY = 8;

/**
 * Run `task(item, index)` against every item with at most `concurrency`
 * in-flight calls. Results are returned in input order. A rejection from
 * any task rejects the whole call — wrap inside `task` if you want
 * per-item error isolation.
 */
export const mapWithConcurrency = async <T, R>(items: ReadonlyArray<T>, concurrency: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> => {
    if (items.length === 0) {
        return [];
    }

    const effective = Math.max(1, Math.min(concurrency, items.length));
    const results: R[] = Array.from({ length: items.length });
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (cursor < items.length) {
            const index = cursor;

            cursor += 1;

            const item = items[index] as T;

            results[index] = await task(item, index);
        }
    };

    await Promise.all(Array.from({ length: effective }, () => worker()));

    return results;
};
