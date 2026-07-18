import type { LiteralUnion } from "type-fest";

import { BEL, OSC } from "./constants";
import { encodeBase64Bytes } from "./utils/base64";

/**
 * Options for controlling the display of an inline image in iTerm2.
 */
export interface ImageOptions {
    /**
     * The display height of the image. It can be specified as:
     * - A number: Interpreted as the number of character cells (e.g., `10`).
     * - A string with `px`: Interpreted as pixels (e.g., `"100px"`).
     * - A string with `%`: Interpreted as a percentage of the terminal session's height (e.g., `"50%"`).
     * - The string `"auto"`: The image's inherent height will be used, or the terminal will decide.
     */
    readonly height?: LiteralUnion<"auto", number | string>;

    /**
     * Controls whether the image's aspect ratio is preserved when scaling.
     * - If `true` (default), the aspect ratio is preserved.
     * - If `false`, the image may be stretched to fit the specified width and height.
     * Corresponds to the `preserveAspectRatio` argument in the iTerm2 sequence (`1` for true, `0` for false).
     * @default true
     */
    readonly preserveAspectRatio?: boolean;

    /**
     * The display width of the image. It can be specified as:
     * - A number: Interpreted as the number of character cells (e.g., `20`).
     * - A string with `px`: Interpreted as pixels (e.g., `"200px"`).
     * - A string with `%`: Interpreted as a percentage of the terminal session's width (e.g., `"75%"`).
     * - The string `"auto"`: The image's inherent width will be used, or the terminal will decide.
     */
    readonly width?: LiteralUnion<"auto", number | string>;
}

/**
 * Generates an ANSI escape sequence for displaying an image inline, primarily for iTerm2.
 *
 * This function constructs a proprietary iTerm2 escape sequence (`OSC 1337 ; File = [arguments] : &lt;base64_data> BEL`)
 * that allows raw image data to be displayed directly in the terminal.
 * @param data The raw image data as a `Uint8Array`. This data will be Base64 encoded.
 * @param options Optional parameters to control how the image is displayed (e.g., width, height, aspect ratio).
 * See {@link ImageOptions}.
 * @returns A string containing the ANSI escape sequence for displaying the image in iTerm2.
 * @example
 * ```typescript
 * import { image } from '@visulima/ansi/image'; // Adjust import path
 * import { promises as fs } from 'fs';
 *
 * async function displayImage() {
 *   try {
 *     const imageData = await fs.readFile('path/to/your/image.png');
 *     const imageSequence = image(new Uint8Array(imageData), {
 *       width: 50, // 50 character cells wide
 *       height: "auto",
 *       preserveAspectRatio: true,
 *     });
 *     console.log(imageSequence);
 *   } catch (error) {
 *     console.error("Error reading or displaying image:", error);
 *   }
 * }
 *
 * displayImage();
 * ```
 * @remarks
 * - This sequence is specific to iTerm2 and may not work in other terminal emulators.
 * - Base64 encoding is runtime-agnostic: it prefers the standardized
 * `Uint8Array.prototype.toBase64` (Node ≥ 24, modern browsers), then `btoa`,
 * then Node's `Buffer`, so the helper works in browser/xterm.js bundles too.
 * - The `name` parameter (for filename) is not directly supported by this simplified helper but is part of the
 * full iTerm2 inline image protocol. For more advanced features, consider using the more detailed iTerm2 sequence
 * builders in `iterm2/` files.
 * @see {@link https://iterm2.com/documentation-images.html} iTerm2 Inline Images Protocol.
 * @see {@link ImageOptions}
 */
export const image = (data: Uint8Array, options: ImageOptions = {}): string => {
    let returnValue = `${OSC}1337;File=inline=1`;

    if (options.width !== undefined) {
        // Check for undefined to allow 0 or "0px"
        returnValue += `;width=${String(options.width)}`;
    }

    if (options.height !== undefined) {
        returnValue += `;height=${String(options.height)}`;
    }

    // preserveAspectRatio defaults to true. Only add the parameter if it's false.
    if (options.preserveAspectRatio === false) {
        returnValue += ";preserveAspectRatio=0";
    }

    const base64Data = encodeBase64Bytes(data);

    return `${returnValue}:${base64Data}${BEL}`;
};
