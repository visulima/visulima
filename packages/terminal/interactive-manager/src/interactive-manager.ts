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

    /** Cached terminal dimensions, refreshed on `resize` instead of per-frame. */
    #size: { columns: number; rows: number };

    /** Bound resize handler so it can be detached on unhook. */
    readonly #onResize: () => void;

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

        this.#size = terminalSize();
        this.#onResize = () => {
            // Querying terminal dimensions is an ioctl round-trip; spinners call update()
            // ~12x/sec per stream, so we cache the size and only refresh it on resize.
            this.#size = terminalSize();
        };

        // When a hook's bounded-history buffer overflows while a frame is on screen it flushes
        // straight to the stream at the cursor — below the frame. Erase the region and forget it
        // first so the flushed output lands above and the next update() repaints from scratch.
        for (const streamName of Object.keys(this.#stream) as StreamType[]) {
            this.#stream[streamName].onEarlyFlush(() => {
                this.erase(streamName);
                this.#lastLength = 0;
                this.#outside = 0;
            });
        }
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
     * Clears the interactive region for a stream and resets its line bookkeeping.
     *
     * This is the public, intent-revealing way to wipe what `update()` last rendered
     * without unhooking. Equivalent to `erase(stream)` followed by a length reset.
     * @param stream The stream whose interactive region should be cleared.
     */
    public clear(stream: StreamType): void {
        this.erase(stream);
        this.#lastLength = 0;
        this.#outside = 0;
    }

    /**
     * Persists the currently rendered frame and resets the line bookkeeping.
     *
     * Unlike {@link clear}, the on-screen output is left in place; subsequent
     * `update()` calls start a fresh interactive region below it. Useful for
     * "freezing" a final spinner/progress frame in the scrollback.
     *
     * The bookkeeping is shared across streams, so the `stream` argument is accepted
     * for symmetry with the other methods but does not change behaviour.
     * @param _stream The stream whose frame should be persisted.
     */
    public done(_stream: StreamType): void {
        // Leave the rendered output untouched, just forget about it so the next
        // update() does not try to erase the now-persisted lines. update() already
        // terminates each frame with a trailing "\n", so the cursor is on a fresh
        // line below the persisted frame; we only need to reset the bookkeeping.
        this.#lastLength = 0;
        this.#outside = 0;
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

        // Refresh cached size on hook and keep it current via the resize event.
        this.#size = terminalSize();

        // Only listen for resize on an interactive TTY; piped/redirected output never
        // emits "resize" and attaching there would just leak a listener.
        if (typeof process !== "undefined" && process.stdout.isTTY && typeof process.stdout.on === "function") {
            process.stdout.on("resize", this.#onResize);
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
            this.#outside = 0;

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

        if (typeof process !== "undefined" && typeof process.stdout.off === "function") {
            process.stdout.off("resize", this.#onResize);
        }

        this.#clear();

        return true;
    }

    /**
     * Update output.
     *
     * Passing an empty `rows` array clears the interactive region for the stream
     * (equivalent to {@link clear}).
     * @param stream Stream to write to
     * @param rows Text lines to write
     * @param from Index of the line starting from which contents are overwritten
     */
    public update(stream: StreamType, rows: string[], from: number = 0): void {
        if (this.#isSuspended) {
            // While suspended the region is handed to external output (a prompt, a subprocess).
            // A still-ticking renderer must not erase or overwrite it; resume() repaints.
            return;
        }

        if (rows.length === 0) {
            // An empty update means "clear the region" — there is otherwise no way to
            // wipe the interactive area through the main API.
            this.clear(stream);

            return;
        }

        const hook = this.#stream[stream];
        const { columns: width, rows: height } = this.#size;

        const position = Math.max(0, Math.min(height - 1, from));
        const actualLength = this.lastLength - position;
        const outside = Math.max(actualLength - height, this.outside);

        // wordWrap returns a single string with embedded "\n" for rows wider than the
        // terminal. Splitting on "\n" turns each logical row into its real visual lines
        // so the erase/length bookkeeping below counts what is actually on screen.
        let output = rows.flatMap((row) =>
            wordWrap(row, {
                trim: false,
                width,
                wrapMode: WrapMode.STRICT_WIDTH,
            }).split("\n"),
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

        // lastLength must measure the full on-screen region from line 0. After a partial update
        // (from > 0) the region is position + output.length lines, so fold position in; storing
        // only output.length would under-erase on the next redraw and strand the lines above.
        this.#lastLength = outside ? outside + output.length + 1 : position + output.length;
        this.#outside = Math.max(this.lastLength - height, this.outside);
    }

    #clear(status: boolean = false): void {
        this.#isActive = status;
        this.#lastLength = 0;
        this.#outside = 0;
    }
}

export default InteractiveManager;
