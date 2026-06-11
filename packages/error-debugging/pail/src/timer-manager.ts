/**
 * Manages console-compatible timers for the Pail logger.
 *
 * Owns the label→start-timestamp map and the insertion-ordered set used to
 * resolve the "most-recent timer" when no label is supplied to `timeLog` /
 * `timeEnd`. All log emission is delegated back to the owning logger via the
 * `emit` callback so this class stays decoupled from the pipeline.
 * @internal
 */
// eslint-disable-next-line import/prefer-default-export -- internal class imported by name in pail.browser.ts and tests; keeping a named export avoids changing those importers/public surface
export class TimerManager {
    readonly #timersMap = new Map<string, number>();

    readonly #seqTimers = new Set<string>();

    readonly #startMessage: string;

    readonly #endMessage: string;

    readonly #emit: (type: string, raw: boolean, force: boolean, ...args: any[]) => void;

    /**
     * @param emit Delegates log emission to the owning PailBrowserImpl's `logger` method.
     * @param startMessage The message emitted when a timer is started (e.g. "Initialized timer...").
     * @param endMessage The message prefix emitted when a timer ends (e.g. "Timer run for:").
     */

    public constructor(emit: (type: string, raw: boolean, force: boolean, ...args: any[]) => void, startMessage: string, endMessage: string) {
        this.#emit = emit;
        this.#startMessage = startMessage;
        this.#endMessage = endMessage;
    }

    /**
     * Starts a timer with the given label.
     *
     * If the label is already active, emits a warning instead of overwriting.
     * @param label Timer label, defaults to `"default"`.
     */
    public time(label = "default"): void {
        if (this.#seqTimers.has(label)) {
            this.#emit("warn", false, false, {
                message: `Timer '${label}' already exists`,
                prefix: label,
            });
        } else {
            this.#seqTimers.add(label);
            this.#timersMap.set(label, Date.now());

            this.#emit("start", false, false, {
                message: this.#startMessage,
                prefix: label,
            });
        }
    }

    /**
     * Logs the elapsed time for a running timer without stopping it.
     *
     * When `label` is omitted the most-recently-started timer is used.
     * @param label Timer label (optional).
     * @param data Additional context to include in the log message.
     */
    public timeLog(label?: string, ...data: unknown[]): void {
        if (!label && this.#seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.#seqTimers].pop();
        }

        if (label && this.#timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.#timersMap.get(label)!;

            this.#emit("info", false, false, {
                context: data,
                message: span < 1000 ? `${String(span)} ms` : `${(span / 1000).toFixed(2)} s`,
                prefix: label,
            });
        } else {
            this.#emit("warn", false, false, {
                context: data,
                message: "Timer not found",
                prefix: label,
            });
        }
    }

    /**
     * Stops a timer and logs the total elapsed time.
     *
     * When `label` is omitted the most-recently-started timer is used.
     * @param label Timer label (optional).
     */
    public timeEnd(label?: string): void {
        if (!label && this.#seqTimers.size > 0) {
            // eslint-disable-next-line no-param-reassign
            label = [...this.#seqTimers].pop();
        }

        if (label && this.#timersMap.has(label)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const span = Date.now() - this.#timersMap.get(label)!;

            this.#timersMap.delete(label);

            this.#emit("stop", false, false, {
                message: `${this.#endMessage} ${span < 1000 ? `${String(span)} ms` : `${(span / 1000).toFixed(2)} s`}`,
                prefix: label,
            });
        } else {
            this.#emit("warn", false, false, {
                message: "Timer not found",
                prefix: label,
            });
        }
    }
}
