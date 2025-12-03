// eslint-disable-next-line import/no-extraneous-dependencies
import { wordWrap, WrapMode } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

import type InteractiveStreamHook from "./interactive-stream-hook";

/** Supported stream types for interactive output */
type StreamType = "stderr" | "stdout";

/**
 * Interactive Manager.
 *
 * Manages interactive terminal output by coordinating stdout and stderr streams.
 * Enables features like progress bars, spinners, and dynamic updates by temporarily
 * capturing and controlling terminal output. Supports suspending and resuming
 * interactive mode for external output.
 * @example
 * ```typescript
 * const manager = new InteractiveManager(stdoutHook, stderrHook);
 *
 * // Start interactive mode
 * manager.hook();
 *
 * // Update output dynamically
 * manager.update("stdout", ["Processing...", "50% complete"]);
 *
 * // Temporarily suspend for external output
 * manager.suspend("stdout");
 * console.log("External message");
 * manager.resume("stdout");
 *
 * // End interactive mode and show final output
 * manager.unhook();
 * ```
 */
class InteractiveManager {
    readonly #stream: {
        stderr: InteractiveStreamHook;
        stdout: InteractiveStreamHook;
    };

    #isActive = false;

    #isSuspended = false;

    #lastLength = 0;

    #outside = 0;

    /**
     * Creates a new InteractiveManager with the given stream hooks.
     * @param stdout Hook for stdout stream
     * @param stderr Hook for stderr stream
     */
    public constructor(stdout: InteractiveStreamHook, stderr: InteractiveStreamHook) {
        this.#stream = {
            stderr,
            stdout,
        };
    }

    /**
     * Last printed rows count.
     *
     * Tracks the number of rows that were last written to the terminal.
     * Used internally for managing cursor positioning and output updates.
     */
    public get lastLength(): number {
        return this.#lastLength;
    }

    /**
     * Rows count outside editable area.
     *
     * Tracks the number of rows that extend beyond the current terminal height.
     * Used for managing scrolling and ensuring all output remains visible.
     */
    public get outside(): number {
        return this.#outside;
    }

    /**
     * Hook activity status.
     *
     * Indicates whether the interactive hooks are currently active.
     * When true, streams are being intercepted for interactive output.
     */
    public get isHooked(): boolean {
        return this.#isActive;
    }

    /**
     * Suspend status for active hooks.
     *
     * Indicates whether interactive mode is temporarily suspended.
     * When suspended, external output can be written without interference.
     */
    public get isSuspended(): boolean {
        return this.#isSuspended;
    }

    /**
     * Removes lines from the terminal output.
     *
     * Erases the specified number of lines from the bottom of the output,
     * moving the cursor up and clearing the lines. Useful for removing
     * previous interactive output before displaying new content.
     * @param stream The stream to erase lines from ("stdout" or "stderr")
     * @param count Number of lines to remove (defaults to lastLength)
     * @throws {TypeError} If the specified stream is not available
     */
    public erase(stream: StreamType, count: number = this.#lastLength): void {
        if (this.#stream[stream] === undefined) {
            throw new TypeError(`Stream "${stream}" is not available`);
        }

        this.#stream[stream].erase(count);
    }

    /**
     * Hook stdout and stderr streams.
     * @returns Success status
     */
    public hook(): boolean {
        if (!this.#isActive) {
            Object.values(this.#stream).forEach((hook) => hook.active());

            this.#clear(true);
        }

        return this.#isActive;
    }

    /**
     * Resume suspend hooks.
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
     * Suspend active hooks for external output.
     * @param stream Stream to suspend
     * @param erase erase output
     */
    public suspend(stream: StreamType, erase: boolean = true): void {
        if (!this.#isSuspended) {
            this.#isSuspended = true;

            if (erase) {
                this.erase(stream);
            }

            Object.values(this.#stream).forEach((hook) => hook.renew());
        }
    }

    /**
     * Unhooks both stdout and stderr streams and print their story of logs.
     * @param separateHistory If `true`, will add an empty line to the history output for individual recorded lines and console logs
     * @returns Success status
     */
    public unhook(separateHistory: boolean = true): boolean {
        if (this.#isActive) {
            Object.values(this.#stream).forEach((hook) => hook.inactive(separateHistory));

            this.#clear();
        }

        return !this.#isActive;
    }

    /**
     * Update output.
     * @param stream Stream to write to
     * @param rows Text lines to write to standard output
     * @param from Index of the line starting from which the contents of the terminal are being overwritten
     */
    public update(stream: StreamType, rows: string[], from: number = 0): void {
        if (rows.length > 0) {
            if (this.#stream[stream] === undefined) {
                throw new TypeError(`Stream "${stream}" is not available`);
            }

            const hook = this.#stream[stream];

            const { columns: width, rows: height } = terminalSize();

            const position = from > height ? height - 1 : Math.max(0, Math.min(height - 1, from));
            const actualLength = this.lastLength - position;
            const outside = Math.max(actualLength - height, this.outside);

            // eslint-disable-next-line unicorn/no-array-reduce
            let output = rows.reduce<string[]>(
                (accumulator, row) => [
                    ...accumulator,
                    wordWrap(row, {
                        trim: false,
                        width,
                        wrapMode: WrapMode.STRICT_WIDTH,
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

    #clear(status: boolean = false): void {
        this.#isActive = status;
        this.#lastLength = 0;
        this.#outside = 0;
    }
}

export default InteractiveManager;
