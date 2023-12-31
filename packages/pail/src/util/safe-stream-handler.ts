import type { Writable } from "node:stream";

/**
 * A handler for writable streams that only writes if the stream has finished
 * processing or draining
 */
export class SafeStreamHandler {
    public _ready = true;

    protected _stream: Writable;

    protected _name: string;

    public constructor(stream: Writable, name: string) {
        this._stream = stream;
        this._name = name;
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this._stream.end(...arguments_);
    }

    protected writeStream(message: string): void {
        if (!this._ready) {
            // eslint-disable-next-line no-console
            console.warn(`Stream busy: ${this._name}. Write will be dropped: "${message}"`);
            return;
        }
        this._ready = false;

        this._stream.on("error", (error) => {
            throw error;
        });
        this._stream.on("drain", () => {
            this._ready = true;

        });
        this._stream.on("finish", () => {
            this._ready = true;

        });
        this._ready = this._stream.write(message, () => {});
    }
}
