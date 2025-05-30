/* eslint-disable no-secrets/no-secrets */
import { BEL, OSC } from "./constants";
import type { IITerm2Payload } from "./iterm2/iterm2-props";

// Re-export specific payload types and props for easier use by consumers
export type { IITerm2Payload, ITerm2FileProps } from "./iterm2/iterm2-props";
export {
    IT2_AUTO,
    it2Cells,
    it2Percent,
    it2Pixels,
} from "./iterm2/iterm2-props";
export {
    ITerm2File,
    ITerm2FileEnd,
    ITerm2FilePart,
    ITerm2MultipartFileStart,
} from "./iterm2/iterm2-sequences";

/**
 * Generates a complete iTerm2 proprietary escape sequence (OSC 1337).
 *
 * This function serves as a general-purpose constructor for iTerm2 escape codes.
 * It takes a payload object that conforms to the {@link IITerm2Payload} interface.
 * The `toString()` method of this payload object is responsible for generating the
 * specific command and arguments part of the sequence (e.g., `File=...`, `ShellIntegrationVersion=...`).
 *
 * The overall structure of the generated sequence is: `OSC 1337 ; &lt;PAYLOAD_STRING> BEL`
 * (`OSC` is `\x1b]`, `BEL` is `\x07`).
 * @param payload An object that implements the {@link IITerm2Payload} interface.
 * This object must have a `toString()` method that returns the string representation
 * of the iTerm2 command-specific payload.
 * Examples include instances of `ITerm2File`, `ITerm2MultipartFileStart`, etc.
 * @returns The fully formed ANSI escape sequence for the iTerm2 command.
 * Returns an empty string if the provided `payload` is invalid (e.g., null, undefined,
 * lacks a proper `toString` method, or its `toString` method is the generic `Object.prototype.toString`).
 * @see {@link https://iterm2.com/documentation-escape-codes.html iTerm2 Escape Codes Documentation}
 *      for a comprehensive list of supported commands and their payloads.
 * @see {@link IITerm2Payload} for the interface requirement.
 * @see Classes like {@link ITerm2File}, {@link ITerm2MultipartFileStart}, {@link ITerm2FilePart}, {@link ITerm2FileEnd}
 *      for concrete examples of payload objects.
 * @example
 * ```typescript
 * import { iTerm2, ITerm2File, ITerm2FileProps } from '@visulima/ansi/iterm2'; // ITerm2FileProps can be used for options
 * import { Buffer } from 'node:buffer';
 *
 * // Example 1: Sending a file inline (like an image)
 * const imageName = "my_image.png";
 * const imageData = Buffer.from("dummyimagecontent"); // Replace with actual Uint8Array image data
 * const imageFileProps: ITerm2FileProps = { // Use ITerm2FileProps for broader options
 *   name: Buffer.from(imageName).toString("base64"), // Name should be base64 encoded
 *   inline: true,
 *   width: "50%",
 *   height: "auto",
 *   ignoreAspectRatio: false, // Equivalent to preserveAspectRatio: true
 * };
 * const filePayload = new ITerm2File(imageFileProps, imageData);
 * const imageSequence = iTerm2(filePayload);
 * console.log(imageSequence);
 * // Expected output (simplified, actual base64 will be longer):
 * // OSC1337;File=name=bXlfaW1hZ2UucG5n;inline=1;width=50%;height=auto:ZHVtbXlpbWFnZWNvbnRlbnQ=BEL
 * // Note: if ignoreAspectRatio was true, preserveAspectRatio=0 would be in the sequence.
 *
 * // Example 2: A hypothetical simple command (e.g., shell integration handshake)
 * const shellIntegrationPayload: IITerm2Payload = {
 *   toString: () => "ShellIntegrationVersion=15;Shell=zsh"
 * };
 * const shellSequence = iTerm2(shellIntegrationPayload);
 * console.log(shellSequence);
 * // Output: OSC1337;ShellIntegrationVersion=15;Shell=zshBEL
 * ```
 */
export const iTerm2 = (payload: IITerm2Payload): string => {
    // Validate the payload to ensure it's usable.
    // It must exist, have a `toString` method, and that method must be a custom one (not Object.prototype.toString).
    if (!payload || typeof payload.toString !== "function" || payload.toString === Object.prototype.toString) {
        // If the payload is invalid, log a warning or return an empty string to prevent malformed sequences.
        // console.warn("Invalid payload provided to iTerm2 function. Payload must implement IITerm2Payload with a custom toString method.");
        return "";
    }

    return `${OSC}1337;${payload.toString()}${BEL}`;
};
