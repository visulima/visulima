// eslint-disable-next-line import/no-extraneous-dependencies
import { wordWrap, WrapMode } from "@visulima/string";
// eslint-disable-next-line import/no-extraneous-dependencies
import terminalSize from "terminal-size";

import type InteractiveStreamHook from "./interactive-stream-hook";
import type { StreamType } from "./types";

/**
 * Interactive Manager.
 *
 * Manages interactive terminal output by coordinating stdout and stderr streams.
 * Enables features like progress bars, spinners, and dynamic updates by temporarily
 * capturing and controlling terminal output.
 * @example
 * ```typescript
 * import { InteractiveManager, InteractiveStreamHook } from '@visulima/interactive-manager';
 *
 * const stdoutHook = new InteractiveStreamHook(process.stdout);
 * const stderrHook = new InteractiveStreamHook(process.stderr);
 * const manager = new InteractiveManager(stdoutHook, stderrHook);
 *
 * manager.hook();
 * manager.update("stdout", ["Processing...", "50% complete"]);
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
     */
    public get lastLength(): number {
        return this.#lastLength;
    }

    /**
     * Rows count outside editable area.
     */
    public get outside(): number {
        return this.#outside;
    }

    /**
     * Hook activity status.
     */
    public get isHooked(): boolean {
        return this.#isActive;
    }

    /**
     * Suspend status for active hooks.
     */
    public get isSuspended(): boolean {
        return this.#isSuspended;
    }

    /**
     * Removes lines from the terminal output.
     * @param stream The stream to erase lines from
     * @param count Number of lines to remove (defaults to lastLength)
     */
    public erase(stream: StreamType, count: number = this.#lastLength): void {
        this.#stream[stream].erase(count);
    }

    /**
     * Hook stdout and stderr streams.
     * @returns Whether the state changed (true if hooks were activated, false if already active)
     */
    public hook(): boolean {
        if (this.#isActive) {
            return false;
        }

        const hooks = Object.values(this.#stream);

        for (const hook of hooks) {
            hook.active();
        }

        this.#clear(true);

        return true;
    }

    /**
     * Resume suspended hooks.
     * @param stream Stream to resume
     * @param eraseRowCount erase output rows count
     */
    public resume(stream: StreamType, eraseRowCount?: number): void {
        if (this.#isSuspended && this.#isActive) {
            this.#isSuspended = false;

            if (eraseRowCount) {
                this.erase(stream, eraseRowCount);
            }

            this.#lastLength = 0;

            const hooks = Object.values(this.#stream);

            for (const hook of hooks) {
                hook.active();
            }
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

            const hooks = Object.values(this.#stream);

            for (const hook of hooks) {
                hook.renew();
            }
        }
    }

    /**
     * Unhooks both stdout and stderr streams and prints their history.
     * @param separateHistory If true, adds an empty line before history output
     * @returns Whether the state changed (true if hooks were deactivated, false if already inactive)
     */
    public unhook(separateHistory: boolean = true): boolean {
        if (!this.#isActive) {
            return false;
        }

        const hooks = Object.values(this.#stream);

        for (const hook of hooks) {
            hook.inactive(separateHistory);
        }

        this.#clear();

        return true;
    }

    /**
     * Update output.
     * @param stream Stream to write to
     * @param rows Text lines to write
     * @param from Index of the line starting from which contents are overwritten
     */
    public update(stream: StreamType, rows: string[], from: number = 0): void {
        if (rows.length > 0) {
            const hook = this.#stream[stream];
            const { columns: width, rows: height } = terminalSize();

            const position = from > height ? height - 1 : Math.max(0, Math.min(height - 1, from));
            const actualLength = this.lastLength - position;
            const outside = Math.max(actualLength - height, this.outside);

            let output = rows.map((row) =>
                wordWrap(row, {
                    trim: false,
                    width,
                    wrapMode: WrapMode.STRICT_WIDTH,
                }),
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
