import type { LiteralUnion } from "type-fest"; // Retain LiteralUnion if used by other exports not shown, or for ITerm2FileProps if it uses it.

/**
 * Represents the special string value `'auto'` used for iTerm2 image or file dimensions.
 * When `'auto'` is used for width or height, the terminal (iTerm2) determines the appropriate dimension
 * based on the image's inherent size or other context.
 * @example `width: IT2_AUTO`
 */
export const IT2_AUTO = "auto";

/**
 * Formats a number as a string representing a dimension in character cells for iTerm2.
 * iTerm2 interprets plain numbers for width/height as character cell counts.
 * @param n The number of character cells.
 * @returns A string representation of the number (e.g., `10` becomes `"10"`).
 * @example
 * \`\`\`typescript
 * const widthInCells = it2Cells(20); // "20"
 * const sequence = `File=width=${widthInCells}`;
 * \`\`\`
 */
export const it2Cells = (n: number): string => n.toString();

/**
 * Formats a number as a string representing a dimension in pixels for iTerm2.
 * Appends `px` to the number.
 * @param n The number of pixels.
 * @returns A string representing the dimension in pixels (e.g., `100` becomes `"100px"`).
 * @example
 * \`\`\`typescript
 * const heightInPixels = it2Pixels(150);
 * const sequence = `File=height=${heightInPixels}`;
 * \`\`\`
 */
export const it2Pixels = (n: number): string => `${n}px`;

/**
 * Formats a number as a string representing a dimension as a percentage for iTerm2.
 * Appends `%` to the number.
 * @param n The percentage value (e.g., `50` for 50%).
 * @returns A string representing the dimension as a percentage (e.g., `50` becomes `"50%"`).
 * @example
 * \`\`\`typescript
 * const widthAsPercentage = it2Percent(75);
 * const sequence = `File=width=${widthAsPercentage}`;
 * \`\`\`
 */
export const it2Percent = (n: number): string => `${n}%`;

/**
 * Defines the interface for any iTerm2 OSC 1337 payload object.
 *
 * An OSC 1337 sequence has the general form: `OSC 1337 ; &lt;payload_string> BEL`.
 * Objects implementing this interface are responsible for generating that `&lt;payload_string>`
 * via their `toString()` method. This allows for a structured way to build various iTerm2 commands.
 * @see {@link iTerm2} function which consumes objects of this type.
 */
export interface IITerm2Payload {
    /**
     * Converts the payload object into its specific string representation required for an iTerm2 OSC 1337 command.
     * For example, for a file transfer, this might return `"File=name=...;size=...:content..."`.
     * @returns The string payload part of the OSC 1337 sequence.
     */
    toString: () => string;
}

/**
 * Defines the properties for an iTerm2 file transfer or inline image display command (`File=...`).
 * These correspond to the key-value pairs used within the `File=` argument of the OSC 1337 sequence.
 * @see {@link https://iterm2.com/documentation-escape-codes.html} iTerm2 Escape Codes (search for `File=`)
 * @see {@link https://iterm2.com/documentation-images.html} iTerm2 Inline Images Protocol
 */
export interface ITerm2FileProps {
    /**
     * The Base64 encoded content of the file or image.
     * This is typically used when `inline=1` is set for images, or for transferring small files directly
     * within the escape sequence. For larger files, multipart transfer is recommended.
     * @remarks The `ITerm2File` class can handle the Base64 encoding of `Uint8Array` data automatically.
     */
    content?: string;

    /**
     * If `true`, instructs the terminal not to move the cursor after displaying an inline image.
     * Corresponds to `doNotMoveCursor=1` in the sequence.
     * This is a WezTerm extension, also supported by iTerm2 beta/nightly builds as of some versions.
     * @default false (cursor behavior is default terminal behavior)
     */
    doNotMoveCursor?: boolean;

    /**
     * The display height of the image or file placeholder.
     * Can be:
     * - A number (interpreted as character cells, e.g., `10`).
     * - A string with units: `"Npx"` (N pixels), `"N%"` (N percent of session height).
     * - The string {@link IT2_AUTO} (`"auto"`) for automatic sizing.
     * Use helper functions like {@link it2Cells}, {@link it2Pixels}, {@link it2Percent} for formatting if needed.
     * @example `10`, `"100px"`, `"50%"`, `IT2_AUTO`
     */
    height?: LiteralUnion<typeof IT2_AUTO, number | string>; // Using LiteralUnion for "auto"

    /**
     * Controls aspect ratio preservation for inline images.
     * - If `true` (or omitted), the aspect ratio *is* preserved (`preserveAspectRatio=1`, which is the default iTerm2 behavior if the param is absent).
     * - If `false`, the aspect ratio is *not* preserved, and the image may stretch (`preserveAspectRatio=0`).
     * @remarks Note the slight inversion: this property `ignoreAspectRatio: true` means `preserveAspectRatio=0` in the sequence.
     * The default iTerm2 behavior *is* to preserve aspect ratio if the `preserveAspectRatio` parameter is not given.
     * So, to *not* preserve, you set this to true to *add* `preserveAspectRatio=0`.
     * If you want to preserve (default), you can omit this or set it to `false`.
     * @default false (meaning aspect ratio is preserved by iTerm2 default unless overridden)
     */
    ignoreAspectRatio?: boolean; // if true, results in preserveAspectRatio=0

    /**
     * If `true`, the file (typically an image) should be displayed inline in the terminal.
     * Corresponds to `inline=1` in the sequence.
     * If `false` or omitted, iTerm2 might prompt for download or handle based on file type.
     * @default false
     */
    inline?: boolean;

    /**
     * The name of the file. This is displayed in UI elements (like a download prompt or image info)
     * and used as the default filename if downloaded.
     * The name **must be Base64 encoded** if it contains special characters (like `;`, `=`, or non-ASCII characters)
     * to ensure correct parsing of the escape sequence by iTerm2.
     * The `ITerm2File` and `ITerm2MultipartFileStart` classes generally expect the name to be pre-encoded if necessary.
     * @example `"bXlmaWxlLnR4dA=="` (Base64 for "myfile.txt")
     */
    name?: string;

    /**
     * The size of the file in bytes. This is used by iTerm2 for progress indication during downloads
     * or to inform inline display mechanisms.
     * JavaScript `number` type is generally sufficient for typical file sizes (up to `Number.MAX_SAFE_INTEGER`).
     */
    size?: number;

    /**
     * The display width of the image or file placeholder.
     * Can be:
     * - A number (interpreted as character cells, e.g., `20`).
     * - A string with units: `"Npx"` (N pixels), `"N%"` (N percent of session width).
     * - The string {@link IT2_AUTO} (`"auto"`) for automatic sizing.
     * Use helper functions like {@link it2Cells}, {@link it2Pixels}, {@link it2Percent} for formatting if needed.
     * @example `20`, `"200px"`, `"75%"`, `IT2_AUTO`
     */
    width?: LiteralUnion<typeof IT2_AUTO, number | string>; // Using LiteralUnion for "auto"
}
