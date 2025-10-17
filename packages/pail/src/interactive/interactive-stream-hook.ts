import { StringDecoder } from "node:string_decoder";

import { cursorHide, cursorShow, eraseLines } from "../utils/ansi-escapes";

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

    readonly #method: NodeJS.WriteStream["write"];

    readonly #stream: NodeJS.WriteStream;

    /**
     * Creates a new InteractiveStreamHook for the given stream.
     * @param stream The Node.js WriteStream to hook into (usually stdout or stderr)
     */
    public constructor(stream: NodeJS.WriteStream) {
        this.#method = stream.write;
        this.#stream = stream;
    }

    /**
     * Activates the stream hook.
     *
     * When active, all writes to the stream are captured in history instead of
     * being written immediately. This allows for interactive features like
     * progress bars that can update dynamically.
     */
    public active(): void {
        this.write(cursorHide as string);

        // @ts-ignore - We are modifying the write method
        this.#stream.write = (data: Uint8Array | string, ...arguments_: [((error?: Error) => void)?] | [(string | undefined)?, ((error?: Error) => void)?]) => {
            const callback = arguments_.at(-1);

            this.#history.push(
                // prettier-ignore
                this.#decoder.write(
                    typeof data === "string"
                        // eslint-disable-next-line sonarjs/no-nested-conditional
                        ? Buffer.from(data, typeof arguments_[0] === "string" ? (arguments_[0] as BufferEncoding) : undefined)
                        : Buffer.from(data),
                ),
            );

            if (typeof callback === "function") {
                callback();
            }

            return InteractiveStreamHook.DRAIN;
        };
    }

    /**
     * Erases the specified number of lines from the terminal.
     *
     * Uses ANSI escape sequences to remove lines from the current cursor position
     * upwards, which is useful for clearing previous output in interactive applications.
     * @param count Number of lines to erase (including the current line)
     */
    public erase(count: number): void {
        if (count > 0) {
            this.write(eraseLines(count + 1) as string);
        }
    }

    /**
     * Deactivates the stream hook and replays captured output.
     *
     * Restores normal stream operation and outputs all captured history.
     * Optionally adds a newline separator before replaying the history.
     * @param separateHistory Whether to add a newline before replaying history
     */
    public inactive(separateHistory = false): void {
        if (this.#history.length > 0) {
            if (separateHistory) {
                this.write("\n");
            }

            this.#history.forEach((element) => {
                this.write(element);
            });
            this.#history = [];
        }

        this.renew();
    }

    /**
     * Renews the stream hook state.
     *
     * Restores the original stream write method and shows the cursor.
     * This is typically called when temporarily suspending interactive mode.
     */
    public renew(): void {
        this.#stream.write = this.#method;
        this.write(cursorShow as string);
    }

    /**
     * Writes a message directly to the underlying stream.
     *
     * Bypasses the hook mechanism and writes directly using the original
     * stream write method. Useful for writing control sequences or
     * messages that should not be captured in history.
     * @param message The message to write to the stream
     */
    public write(message: string): void {
        this.#method.apply(this.#stream, [message]);
    }
}

export default InteractiveStreamHook;
