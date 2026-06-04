import { StringDecoder } from "node:string_decoder";

// eslint-disable-next-line import/no-extraneous-dependencies
import { cursorHide, cursorShow, eraseLines } from "@visulima/ansi";

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
        this.#method = stream.write.bind(stream);
        this.#stream = stream;
    }

    /**
     * Activates the stream hook.
     *
     * When active, all writes to the stream are captured in history instead of
     * being written immediately.
     */
    public active(): void {
        this.write(cursorHide);

        // We are modifying the write method; cast keeps signature drift visible instead of suppressed.
        (this.#stream.write as NodeJS.WriteStream["write"]) = (data: Uint8Array | string, ...arguments_: [((error?: Error) => void)?] | [(string | undefined)?, ((error?: Error) => void)?]) => {
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
     * @param count Number of lines to erase (including the current line)
     */
    public erase(count: number): void {
        if (count > 0) {
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

            this.#history.forEach((element) => {
                this.write(element);
            });

            const tail = this.#decoder.end();

            if (tail) {
                this.write(tail);
            }

            this.#history = [];
        }

        this.renew();
    }

    /**
     * Renews the stream hook state.
     *
     * Restores the original stream write method and shows the cursor.
     */
    public renew(): void {
        this.#stream.write = this.#method;
        this.write(cursorShow);
    }

    /**
     * Writes a message directly to the underlying stream, bypassing the hook.
     * @param message The message to write to the stream
     */
    public write(message: string): void {
        this.#method.apply(this.#stream, [message]);
    }
}

export default InteractiveStreamHook;
