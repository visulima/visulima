import { StringDecoder } from "node:string_decoder";

import { cursorHide, cursorShow, eraseLines } from "../utils/ansi-escapes";

class InteractiveStreamHook {
    public static readonly DRAIN = true;

    readonly #decoder = new StringDecoder();

    #history: string[] = [];

    readonly #method: NodeJS.WriteStream["write"];

    readonly #stream: NodeJS.WriteStream;

    public constructor(stream: NodeJS.WriteStream) {
        this.#method = stream.write;
        this.#stream = stream;
    }

    public active(): void {
        this.write(cursorHide as string);

        // @ts-ignore - We are modifying the write method
        this.#stream.write = (data: Uint8Array | string, ...arguments_: [((error?: Error) => void)?] | [(string | undefined)?, ((error?: Error) => void)?]) => {
            const callback = arguments_.at(-1);

            this.#history.push(
                this.#decoder.write(
                    typeof data === "string"
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

    public erase(count: number): void {
        if (count > 0) {
            this.write(eraseLines(count + 1) as string);
        }
    }

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

    public renew(): void {
        this.#stream.write = this.#method;
        this.write(cursorShow as string);
    }

    public write(message: string): void {
        this.#method.apply(this.#stream, [message]);
    }
}

export default InteractiveStreamHook;
