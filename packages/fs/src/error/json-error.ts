/**
 * Custom error class for handling JSON parsing or related errors.
 * It can optionally include a file name and a code frame for better debugging.
 * @example
 * ```javascript
 * import { JSONError } from "@visulima/fs/error";
 * import { readJsonSync } from "@visulima/fs"; // Or any function that might throw this
 * import { join } from "node:path";
 *
 * try {
 *   // Imagine readJsonSync encounters a malformed JSON file and throws JSONError
 *   // Forcing the scenario for demonstration:
 *   const simulateJsonError = (filePath, content) => {
 *     const err = new JSONError(`Unexpected token '}' at position 15`);
 *     err.fileName = filePath;
 *     // A real implementation might generate a code frame using a library
 *     err.codeFrame = `  13 |   "key": "value",
> 14 |   "anotherKey": "anotherValue",}
     |                             ^
  15 |   "lastKey": "end"
`;
 *     throw err;
 *   };
 *
 *   simulateJsonError(join("path", "to", "corrupted.json"), '{ "key": "value", "anotherKey": "anotherValue",} ');
 *   // const jsonData = readJsonSync(join("path", "to", "corrupted.json"));
 * } catch (error) {
 *   if (error instanceof JSONError) {
 *     console.error(`JSON Error: ${error.message}`);
 *     // message property will include fileName and codeFrame if they were set.
 *     // console.error(`File: ${error.fileName}`);
 *     // console.error(`Code Frame:\n${error.codeFrame}`);
 *   } else {
 *     console.error("An unexpected error occurred:", error);
 *   }
 * }
 * ```
 */
class JSONError extends Error {
    public fileName: string | undefined;

    public codeFrame: string | undefined;

    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "JSONError";

    #message;

    /**
     * Creates a new JSONError instance.
     * @param message The primary error message.
     */
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
