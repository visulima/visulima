// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";
// eslint-disable-next-line import/no-extraneous-dependencies
import wrapAnsi from "wrap-ansi";

import type InteractiveStreamHook from "./interactive-stream-hook";

type StreamType = "stderr" | "stdout";

class InteractiveManager {
    readonly #stream: {
        stderr: InteractiveStreamHook;
        stdout: InteractiveStreamHook;
    };

    #isActive = false;

    #isSuspended = false;

    #lastLength = 0;

    #outside = 0;

    public constructor(stdout: InteractiveStreamHook, stderr: InteractiveStreamHook) {
        this.#stream = {
            stderr,
            stdout,
        };
    }

    /**
     * Last printed rows count
     */
    public get lastLength(): number {
        return this.#lastLength;
    }

    /**
     * Rows count outside editable area
     */
    public get outside(): number {
        return this.#outside;
    }

    /**
     * Hook activity status
     */
    public get isHooked(): boolean {
        return this.#isActive;
    }

    /**
     * Suspend status for active hooks
     */
    public get isSuspended(): boolean {
        return this.#isSuspended;
    }

    /**
     * Removes from the bottom of output up the specified count of lines
     * @param stream Stream to remove lines from
     * @param count lines count to remove
     */
    public erase(stream: StreamType, count = this.#lastLength): void {
        // eslint-disable-next-line security/detect-object-injection
        if (this.#stream[stream] === undefined) {
            throw new TypeError(`Stream "${stream}" is not available`);
        }

        // eslint-disable-next-line security/detect-object-injection
        this.#stream[stream].erase(count);
    }

    /**
     * Hook stdout and stderr streams
     * @returns Success status
     */
    public hook(): boolean {
        if (!this.#isActive) {
            Object.values(this.#stream).forEach((hook) => hook.active());

            this._clear(true);
        }

        return this.#isActive;
    }

    /**
     * Resume suspend hooks
     * @param stream Stream to resume
     * @param eraseRowCount erase output rows count
     */
    public resume(stream: StreamType, eraseRowCount?: number): void {
        if (this.#isSuspended) {
            this.#isSuspended = false;

            if (eraseRowCount) {
                this.erase(stream, eraseRowCount);
            }

            this.#lastLength = 0;

            Object.values(this.#stream).forEach((hook) => hook.active());
        }
    }

    /**
     * Suspend active hooks for external output
     * @param stream Stream to suspend
     * @param erase erase output
     */
    public suspend(stream: StreamType, erase = true): void {
        if (!this.#isSuspended) {
            this.#isSuspended = true;

            if (erase) {
                this.erase(stream);
            }

            Object.values(this.#stream).forEach((hook) => hook.renew());
        }
    }

    /**
     * Unhooks both stdout and stderr streams and print their story of logs
     * @param separateHistory If `true`, will add an empty line to the history output for individual recorded lines and console logs
     * @returns Success status
     */
    public unhook(separateHistory = true): boolean {
        if (this.#isActive) {
            Object.values(this.#stream).forEach((hook) => hook.inactive(separateHistory));

            this._clear();
        }

        return !this.#isActive;
    }

    /**
     * Update output
     * @param stream Stream to write to
     * @param rows Text lines to write to standard output
     * @param from Index of the line starting from which the contents of the terminal are being overwritten
     */
    public update(stream: StreamType, rows: string[], from = 0): void {
        if (rows.length > 0) {
            // eslint-disable-next-line security/detect-object-injection
            if (this.#stream[stream] === undefined) {
                throw new TypeError(`Stream "${stream}" is not available`);
            }

            // eslint-disable-next-line security/detect-object-injection
            const hook = this.#stream[stream];

            const { columns: width, rows: height } = terminalSize();

            const position = from > height ? height - 1 : Math.max(0, Math.min(height - 1, from));
            const actualLength = this.lastLength - position;
            const outside = Math.max(actualLength - height, this.outside);

            // eslint-disable-next-line unicorn/no-array-reduce
            let output = rows.reduce<string[]>(
                (accumulator, row) => [
                    ...accumulator,
                    wrapAnsi(row, width, {
                        hard: true,
                        trim: false,
                        wordWrap: true,
                    }),
                ],
                [],
            );

            if (height <= actualLength) {
                hook.erase(height);

                if (position < outside) {
                    output = output.slice(outside - position + 1);
                }
            } else if (actualLength) {
                hook.erase(actualLength);
            }

            hook.write(`${output.join("\n")}\n`);

            this.#lastLength = outside ? outside + output.length + 1 : output.length;
            this.#outside = Math.max(this.lastLength - height, this.outside);
        }
    }

    private _clear(status = false): void {
        this.#isActive = status;
        this.#lastLength = 0;
        this.#outside = 0;
    }
}

export default InteractiveManager;
