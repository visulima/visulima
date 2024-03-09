class JSONError extends Error {

    public fileName: string | undefined = null;

    public codeFrame: string | null = null;

    private override readonly name = "JSONError";

    #message;

    public constructor(message: string) {
        // We cannot pass message to `super()`, otherwise the message accessor will be overridden.
        // https://262.ecma-international.org/14.0/#sec-error-message
        super();

        this.#message = message;

        Error.captureStackTrace(this, JSONError);
    }

    public override get message(): string {
        return `${this.#message}${this.fileName ? ` in ${this.fileName}` : ""}${this.codeFrame ? `\n\n${this.codeFrame}\n` : ""}`;
    }

    public override set message(message: string) {
        this.#message = message;
    }
}

export default JSONError;
