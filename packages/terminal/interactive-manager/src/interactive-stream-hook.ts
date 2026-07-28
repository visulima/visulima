import { StringDecoder } from "node:string_decoder";

// eslint-disable-next-line import/no-extraneous-dependencies
import { cursorHide, cursorShow, eraseLines } from "@visulima/ansi";

/** Default maximum number of buffered history entries before an early flush is triggered. */
const DEFAULT_MAX_HISTORY = 10_000;

/**
 * Options for {@link InteractiveStreamHook}.
 */
interface InteractiveStreamHookOptions {
    /**
     * Maximum number of intercepted writes kept in the in-memory history buffer.
     *
     * While the hook is active every write to the underlying stream is buffered so it
     * can be replayed in order once the hook is released. For a long-running interactive
     * session wrapped around a chatty subprocess this buffer can grow without bound.
     * When the buffer reaches this threshold the oldest entries are flushed directly to
     * the stream (above the interactive region) so memory stays bounded.
     *
     * Set to `Infinity` to disable the early flush and keep the original
     * accumulate-everything behaviour.
     * @default 10000
     */
    maxHistory?: number;
}

/**
 * Interactive Stream Hook.
 *
 * A utility class that hooks into Node.js WriteStreams to capture output
 * for interactive terminal applications. It allows temporarily intercepting
 * stream writes to enable features like progress bars and dynamic updates.
 * @example
 * ```typescript
 * const hook = new InteractiveStreamHook(process.stdout);
 * hook.active(); // Start capturing output
 *
 * // Output will be stored in history instead of being written to stdout
 * console.log("This won't appear immediately");
 *
 * hook.inactive(); // Stop capturing and replay stored output
 * ```
 */
class InteractiveStreamHook {
    /** Constant indicating the stream write operation was successful */
    public static readonly DRAIN = true;

    readonly #decoder = new StringDecoder();

    #history: string[] = [];

    /** The hook's own write override, captured so we can detect external re-patching. */
    #patched: NodeJS.WriteStream["write"] | undefined;

    /** Invoked on a TTY right before an early history flush so the owner can clear the region. */
    #onEarlyFlush: (() => void) | undefined;

    readonly #maxHistory: number;

    readonly #method: NodeJS.WriteStream["write"];

    readonly #stream: NodeJS.WriteStream;

    /**
     * Whether the underlying stream is an interactive TTY.
     *
     * When `false` (piped output, redirected to a file, CI logs) the hook degrades to
     * plain sequential writes and skips all cursor/erase escape sequences so the output
     * stays readable instead of being garbled by control characters.
     */
    public readonly isTTY: boolean;

    /**
     * Creates a new InteractiveStreamHook for the given stream.
     * @param stream The Node.js WriteStream to hook into (usually stdout or stderr)
     * @param options Optional configuration for the hook
     */
    public constructor(stream: NodeJS.WriteStream, options: InteractiveStreamHookOptions = {}) {
        this.#method = stream.write.bind(stream);
        this.#stream = stream;
        this.#maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
        this.isTTY = stream.isTTY;
    }

    /**
     * Activates the stream hook.
     *
     * When active, all writes to the stream are captured in history instead of
     * being written immediately. On a non-TTY stream the cursor-hide escape is skipped.
     */
    public active(): void {
        if (this.isTTY) {
            this.write(cursorHide);
        }

        // We are modifying the write method; cast keeps signature drift visible instead of suppressed.
        const patched = (data: Uint8Array | string, ...arguments_: [((error?: Error) => void)?] | [(string | undefined)?, ((error?: Error) => void)?]) => {
            const callback = arguments_.at(-1);

            this.#history.push(
                // String writes are already decoded text; pushing them verbatim preserves
                // their original encoding. Only Uint8Array chunks go through the shared UTF-8
                // decoder, which correctly reassembles multibyte sequences split across writes.
                typeof data === "string" ? data : this.#decoder.write(Buffer.from(data)),
            );

            // Keep the history buffer bounded: when it grows past the configured
            // threshold flush the oldest half straight to the stream (above the
            // interactive region) so a long-running, chatty session does not leak memory.
            if (this.#history.length > this.#maxHistory) {
                // On a TTY the flushed entries are written at the cursor, which sits below a
                // rendered frame. Let the owner erase that region first so history lands above
                // it and the next redraw repaints cleanly instead of tearing.
                if (this.isTTY && this.#onEarlyFlush !== undefined) {
                    this.#onEarlyFlush();
                }

                this.#flushHistory(this.#history.length - Math.floor(this.#maxHistory / 2));
            }

            if (typeof callback === "function") {
                callback();
            }

            return InteractiveStreamHook.DRAIN;
        };

        this.#patched = patched;
        this.#stream.write = this.#patched;
    }

    /**
     * Erases the specified number of lines from the terminal.
     *
     * No-op on non-TTY streams, where moving the cursor up to overwrite previous
     * output is not possible (and the escape would corrupt redirected output).
     * @param count Number of lines to erase (including the current line)
     */
    public erase(count: number): void {
        if (count > 0 && this.isTTY) {
            this.write(eraseLines(count + 1));
        }
    }

    /**
     * Deactivates the stream hook and replays captured output.
     * @param separateHistory Whether to add a newline before replaying history
     */
    public inactive(separateHistory = false): void {
        if (this.#history.length > 0) {
            if (separateHistory) {
                this.write("\n");
            }

            this.#flushHistory(this.#history.length);
        }

        const tail = this.#decoder.end();

        if (tail) {
            this.write(tail);
        }

        this.renew();
    }

    /**
     * Renews the stream hook state.
     *
     * Restores the original stream write method and shows the cursor.
     *
     * If the stream's `write` was re-patched by a third party (a second hook instance,
     * `patch-console`, a logger) after this hook installed its own override, the original
     * method is *not* restored — doing so would silently remove the other patch. A warning
     * is emitted instead so the conflict is visible.
     */
    public renew(): void {
        // Only restore if our override is still the active write method. If something
        // else patched write on top of ours, blindly reassigning #method would stomp it.
        if (this.#patched === undefined || this.#stream.write === this.#patched) {
            this.#stream.write = this.#method;
        } else {
            // eslint-disable-next-line no-console -- intentional diagnostic for a real misuse the consumer must see.
            console.warn(
                "[@visulima/interactive-manager] stream.write was replaced by a third party while the hook was active; leaving it untouched to avoid stomping the other patch.",
            );
        }

        this.#patched = undefined;

        if (this.isTTY) {
            this.write(cursorShow);
        }
    }

    /**
     * Registers a callback invoked immediately before the bounded-history early flush
     * writes buffered entries to the stream.
     *
     * The early flush fires from inside an active hook, so on a TTY the cursor is parked
     * below whatever interactive frame is currently rendered. The owner (InteractiveManager)
     * uses this to erase that frame and reset its line bookkeeping so the flushed history is
     * pushed into the scrollback above the region instead of tearing through it. Only invoked
     * on a TTY; non-TTY flushes are plain sequential appends with no region to coordinate.
     * @param callback Handler to run before an early flush, or `undefined` to clear it.
     */
    public onEarlyFlush(callback: (() => void) | undefined): void {
        this.#onEarlyFlush = callback;
    }

    /**
     * Writes a message directly to the underlying stream, bypassing the hook.
     * @param message The message to write to the stream
     */
    public write(message: string): void {
        this.#method.apply(this.#stream, [message]);
    }

    /**
     * Flushes the oldest `count` history entries directly to the underlying stream.
     * @param count Number of leading entries to write out and drop.
     */
    #flushHistory(count: number): void {
        if (count <= 0) {
            return;
        }

        const flushed = this.#history.splice(0, count);

        for (const element of flushed) {
            this.write(element);
        }
    }
}

export type { InteractiveStreamHookOptions };
export default InteractiveStreamHook;
