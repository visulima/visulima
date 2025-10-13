import type { Writable } from "node:stream";

/**
 * A handler for writable streams that only writes if the stream has finished
 * processing or draining
 */
class SafeStreamHandler {
    #ready = true;

    readonly #stream: Writable;

    readonly #name: string;

    public constructor(stream: Writable, name: string) {
        this.#stream = stream;
        this.#name = name;
    }

    /**
     * Writes `message` to the instance's internal stream
     * @param message Message to write
     */
    public write(message: string): void {
        this.writeStream(message);
    }

    /**
     * Calls `end` on this instance's internal stream
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public end(...arguments_: any[]): void {
        this.#stream.end(...arguments_);
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

        this.#stream.on("error", (error) => {
            throw error;
        });

        this.#stream.on("drain", () => {
            this.#ready = true;
        });

        this.#stream.on("finish", () => {
            this.#ready = true;
        });

        this.#ready = this.#stream.write(message, () => {});
    }
}

export default SafeStreamHandler;
