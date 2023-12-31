 
import terminalSize from "terminal-size";
import wrapAnsi from "wrap-ansi";

import type { InteractiveStreamHook } from "./interactive-stream-hook";

export class InteractiveManager {
    readonly #hooks: InteractiveStreamHook[];

    #isActive = false;

    #isSuspended = false;

    #lastLength = 0;

    #outside = 0;

    public constructor(stdout: InteractiveStreamHook, stderr: InteractiveStreamHook) {
        this.#hooks = [stdout, stderr];
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
     * @param count - lines count to remove
     */
    public erase(count = this.#lastLength): void {
        const [hook] = this.#hooks;

        if (hook) {
            hook.erase(count);
        }
    }

    /**
     * Hook stdout and stderr streams
     * @returns Success status
     */
    public hook(): boolean {
        if (!this.#isActive) {
            this.#hooks.forEach((hook) => hook.active());
            this.clear(true);
        }

        return this.#isActive;
    }

    /**
     * Resume suspend hooks
     * @param eraseRowCount - erase output rows count
     */
    public resume(eraseRowCount?: number): void {
        if (this.#isSuspended) {
            this.#isSuspended = false;

            if (eraseRowCount) {
                this.erase(eraseRowCount);
            }

            this.#lastLength = 0;
            this.#hooks.forEach((hook) => hook.active());
        }
    }

    /**
     * Suspend active hooks for external output
     * @param erase - erase output
     */
    public suspend(erase = true): void {
        if (!this.#isSuspended) {
            this.#isSuspended = true;

            if (erase) {
                this.erase();
            }

            this.#hooks.forEach((hook) => hook.renew());
        }
    }

    /**
     * Unhooks both stdout and stderr streams and print their story of logs
     *
     * @param separateHistory - If `true`, will add an empty line to the history output for individual recorded lines and console logs
     *
     * @returns Success status
     */
    public unhook(separateHistory = true): boolean {
        if (this.#isActive) {
            this.#hooks.forEach((hook) => hook.inactive(separateHistory));
            this.clear();
        }

        return !this.#isActive;
    }

    /**
     * Update output
     * @param rows - Text lines to write to standard output
     * @param from - Index of the line starting from which the contents of the terminal are being overwritten
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public update(rows: string[], from = 0): void {
        if (rows.length > 0) {
            const [hook] = this.#hooks;

            if (hook) {
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
    }

    private clear(status = false): void {
        this.#isActive = status;
        this.#lastLength = 0;
        this.#outside = 0;
    }
}
