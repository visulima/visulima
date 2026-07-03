/**
 * Manages console-compatible counters for the Pail logger.
 *
 * Owns the label→count map used by `count` and `countReset`. All log emission
 * is delegated back to the owning logger via the `emit` callback so this class
 * stays decoupled from the logging pipeline.
 * @internal
 */
// eslint-disable-next-line import/prefer-default-export -- internal class imported by name in pail.browser.ts and tests; keeping a named export avoids changing those importers/public surface
export class CounterManager {
    readonly #countMap = new Map<string, number>();

    readonly #emit: (type: string, raw: boolean, force: boolean, ...args: any[]) => void;

    /**
     * @param emit Delegates log emission to the owning PailBrowserImpl's `logger` method.
     */

    public constructor(emit: (type: string, raw: boolean, force: boolean, ...args: any[]) => void) {
        this.#emit = emit;
    }

    /**
     * Increments and logs the counter for the given label.
     * @param label Counter label, defaults to `"default"`.
     */
    public count(label = "default"): void {
        const current = this.#countMap.get(label) ?? 0;

        this.#countMap.set(label, current + 1);

        this.#emit("log", false, false, {
            message: `${label}: ${String(current + 1)}`,
            prefix: label,
        });
    }

    /**
     * Resets the counter for the given label.
     *
     * Emits a warning when the label has no active counter.
     * @param label Counter label, defaults to `"default"`.
     */
    public countReset(label = "default"): void {
        if (this.#countMap.has(label)) {
            this.#countMap.delete(label);
        } else {
            this.#emit("warn", false, false, {
                message: `Count for ${label} does not exist`,
                prefix: label,
            });
        }
    }
}
