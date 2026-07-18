import type { Writable } from "node:stream";

/**
 * A handler for writable streams that only writes if the stream has finished
 * processing or draining
 */
class SafeStreamHandler {
    #ready = true;

    readonly #stream: Writable;

    readonly #name: string;

    readonly #onError: (error: Error, name: string) => void;

    public constructor(stream: Writable, name: string, onError?: (error: Error, name: string) => void) {
        this.#stream = stream;
        this.#name = name;
        this.#onError
            = onError
            ?? ((error, streamName) => {
                // eslint-disable-next-line no-console
                console.error(`Stream error: ${streamName}. Writes will be dropped.`, error);
            });

        this.#stream.on("error", (error: Error) => {
            // Stream 'error' events fire asynchronously, so rethrowing here would
            // escape to uncaughtException and crash the host. Report non-fatally and
            // stop writing to the failed stream instead.
            this.#ready = false;
            this.#onError(error, this.#name);
        });

        this.#stream.on("drain", () => {
            this.#ready = true;
        });

        this.#stream.on("finish", () => {
            this.#ready = true;
        });
    }

    /**
     * Writes `message` to the instance's internal stream.
     * @param message Message to write
     */
    public write(message: string): void {
        this.writeStream(message);
    }

    /**
     * Calls `end` on this instance's internal stream
     */

    public end(...arguments_: any[]): void {
        this.#stream.end(...(arguments_ as [unknown]));
    }

    public get isReady(): boolean {
        return this.#ready;
    }

    protected writeStream(message: string): void {
        if (!this.#ready) {
            // eslint-disable-next-line no-console
            console.warn(`Stream busy: ${this.#name}. Write will be dropped: "${message}"`);

            return;
        }

        this.#ready = false;

        this.#ready = this.#stream.write(message, () => {});
    }
}

export default SafeStreamHandler;
