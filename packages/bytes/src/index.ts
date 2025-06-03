import { Buffer } from "node:buffer";

/**
 * Converts a Node.js Buffer to a Uint8Array.
 * Note: While Buffer instances are Uint8Array instances, this function
 * creates a new Uint8Array view on the Buffer's underlying ArrayBuffer,
 * ensuring correct byteOffset and length.
 * @param buf The Buffer to convert.
 * @returns A Uint8Array view of the Buffer.
 */
export const bufferToUint8Array = (buf: Buffer): Uint8Array => new Uint8Array(buf.buffer, buf.byteOffset, buf.length);

/**
 * Checks if a value is a Uint8Array or, in a Node.js environment, a Buffer.
 * @param x The value to check.
 * @returns True if x is a Uint8Array or Buffer, false otherwise.
 */
export const isUint8Array
  = typeof Buffer === "function"
      ? (x: unknown): x is Uint8Array => x instanceof Uint8Array || Buffer.isBuffer(x)
      : (x: unknown): x is Uint8Array => x instanceof Uint8Array;

/**
 * Converts an ASCII string, array of strings, or template literal to a Uint8Array.
 * Each character is converted to its ASCII byte value (0-255). Characters outside this range will be truncated.
 * @param txt The input string, array of strings, or template strings array.
 * @returns A Uint8Array representing the ASCII encoded string.
 */
export const asciiToUint8Array = (txt: TemplateStringsArray | string | [string]): Uint8Array => {
    if (typeof txt === "string")
        return asciiToUint8Array([txt]);

    const [input] = Array.isArray(txt) ? txt : [String.raw(txt as TemplateStringsArray)]; // Handle TemplateStringsArray
    const inputLength = input.length;
    const result = new Uint8Array(inputLength); // Renamed 'res' to 'result'

    for (let index = 0; index < inputLength; index += 1) { // Changed index++ to index += 1
        // eslint-disable-next-line unicorn/prefer-code-point, no-bitwise
        result[index] = input.charCodeAt(index) & 0xFF; // Ensure ASCII range
    }

    return result;
};

/**
 * Converts a UTF-8 string, array of strings, or template literal to a Uint8Array.
 * Requires Node.js Buffer support.
 * @param txt The input string, array of strings, or template strings array.
 * @returns A Uint8Array representing the UTF-8 encoded string.
 */
export const utf8ToUint8Array = (txt: TemplateStringsArray | [string] | string): Uint8Array => {
    if (typeof txt === "string")
        return utf8ToUint8Array([txt]);

    const [input] = Array.isArray(txt) ? txt : [String.raw(txt as TemplateStringsArray)]; // Handle TemplateStringsArray

    return bufferToUint8Array(Buffer.from(input, "utf8"));
};

/**
 * Attempts to convert various data types to a Uint8Array.
 * Supports Uint8Array (returns as is), ArrayBuffer, Array of numbers.
 * In Node.js, also supports Buffer (returns as is or converts from other types via Buffer.from).
 * @param data The data to convert.
 * @returns A Uint8Array representation of the input data.
 * @throws Error 'UINT8ARRAY_INCOMPATIBLE' if the data cannot be converted and Buffer is not available for fallback.
 */
export const toUint8Array = (data: unknown): Uint8Array => {
    if (typeof Buffer === "function" && Buffer.isBuffer(data)) {
        return bufferToUint8Array(data); // Prioritize Buffer and ensure plain Uint8Array
    }

    if (data instanceof Uint8Array) { // This will now handle non-Buffer Uint8Arrays
        return data;
    }

    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);

    // Ensure it's an array of numbers before creating Uint8Array from it
    if (Array.isArray(data) && data.every((item) => typeof item === "number")) {
        return new Uint8Array(data);
    }

    if (typeof Buffer === "function") {
        if (Buffer.isBuffer(data)) {
            return bufferToUint8Array(data); // Use our converter for consistency
        }

        // Attempt to convert string via Buffer.from.
        // Other Buffer-compatible types like ArrayBuffer or ArrayBufferView (which Buffer is)
        // are typically handled by earlier checks or are Buffers themselves.
        if (typeof data === "string") {
            try {
                return bufferToUint8Array(Buffer.from(data));
            } catch {
                // If Buffer.from fails, fall through to error
            }
        }
    }

    throw new Error("UINT8ARRAY_INCOMPATIBLE: Cannot convert data to Uint8Array");
};

// eslint-disable-next-line import/no-extraneous-dependencies
export * from "@std/bytes";
