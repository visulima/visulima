/* eslint-disable no-secrets/no-secrets */
/* eslint-disable max-classes-per-file */
import { Buffer } from "node:buffer";

import type { IITerm2Payload, ITerm2FileProperties } from "./iterm2-properties";

/**
 * Formats the core properties part of an iTerm2 file-related sequence string.
 * This function takes an object of {@link ITerm2FileProps} and constructs a semicolon-separated
 * string of key-value pairs (e.g., `name=...;size=...;inline=1`).
 * This formatted string is then used as part of commands like `File=` or `MultipartFile=`.
 * @param properties An object containing a subset of {@link ITerm2FileProps}.
 * Only properties that are set in this object will be included in the output string.
 * @returns A string of semicolon-separated key-value pairs for iTerm2 file properties.
 * Returns an empty string if no relevant properties are provided in the `props` object.
 * @remarks
 * - The `name` property within `props` is expected to be Base64 encoded by the caller if it contains
 * special characters (like `;`, `=`, or non-ASCII characters) to ensure the sequence is parsed correctly by iTerm2.
 * - The function correctly handles boolean flags like `inline` (becomes `inline=1`) and
 * `ignoreAspectRatio` (becomes `preserveAspectRatio=0`).
 * - `width` and `height` are converted to strings if they are numbers.
 * @example
 * ```typescript
 * const props1: Partial<ITerm2FileProps> = {
 *   name: "Zm9vLnR4dA==", // Base64 for "foo.txt"
 *   size: 1024,
 *   inline: true,
 *   width: 80,
 *   ignoreAspectRatio: true
 * };
 * formatITerm2FileProps(props1);
 * // Output: "name=Zm9vLnR4dA==;size=1024;width=80;preserveAspectRatio=0;inline=1"
 *
 * const props2: Partial<ITerm2FileProps> = { width: "100px", height: "auto" };
 * formatITerm2FileProps(props2); // Output: "width=100px;height=auto"
 *
 * const props3: Partial<ITerm2FileProps> = { doNotMoveCursor: true };
 * formatITerm2FileProps(props3); // Output: "doNotMoveCursor=1"
 * ```
 * @internal
 */
const formatITerm2FileProperties = (properties: Partial<ITerm2FileProperties>): string => {
    const options: string[] = [];

    // Order can matter for readability or specific terminal quirks, though generally flexible.
    // Prioritizing common/identifying properties first.
    if (properties.name) {
        options.push(`name=${properties.name}`);
    }

    if (properties.size !== undefined) {
        options.push(`size=${properties.size}`);
    }

    if (properties.width !== undefined) {
        options.push(`width=${properties.width.toString()}`);
    }

    if (properties.height !== undefined) {
        options.push(`height=${properties.height.toString()}`);
    }

    // Note: iTerm2 default is to preserve aspect ratio if 'preserveAspectRatio' is absent.
    // So, we only add 'preserveAspectRatio=0' if ignoreAspectRatio is true.
    if (properties.ignoreAspectRatio) {
        // maps to preserveAspectRatio=0
        options.push("preserveAspectRatio=0");
    }

    if (properties.inline) {
        // Results in inline=1
        options.push("inline=1");
    }

    if (properties.doNotMoveCursor) {
        // Results in doNotMoveCursor=1
        options.push("doNotMoveCursor=1");
    }

    return options.join(";");
};

/**
 * Represents the payload for a complete iTerm2 file transfer or an inline image display command.
 * This class is used to construct the part of the OSC 1337 sequence that follows `File=`.
 * The generated payload can be either:
 * - `File=[PROPERTIES]:[BASE64_CONTENT]` (for inline content)
 * - `File=[PROPERTIES]` (if content is not provided directly, e.g., for a download announcement)
 *
 * Implements {@link IITerm2Payload} for use with the generic `iTerm2` function.
 * @see {@link ITerm2FileProps} for property details.
 * @see {@link iTerm2} for the function that wraps this payload into a full escape sequence.
 */
export class ITerm2File implements IITerm2Payload {
    private readonly fileProps: ITerm2FileProperties;

    /**
     * Constructs an `ITerm2File` payload object.
     * @param properties An object containing properties for the file/image, as defined by {@link ITerm2FileProps}.
     * The `name` property within `props` should be pre-Base64 encoded by the caller if it might
     * contain special characters (like `;`, `=`, or non-ASCII characters).
     * If `fileData` is provided, `props.content` will be overridden, and `props.size` will be
     * set from `fileData.byteLength` if not already present in `props`.
     * @param fileData (Optional) A `Uint8Array` containing the raw file data. If provided, this data will be
     * Base64 encoded and used as the `content` of the file transfer. The `size` property
     * will also be automatically set from `fileData.byteLength` if not specified in `props`.
     */
    public constructor(properties: ITerm2FileProperties, fileData?: Uint8Array) {
        // Clone props to avoid modifying the original object, especially if fileData is processed.
        this.fileProps = { ...properties };

        if (fileData) {
            // Add reasonable size limit (e.g., 10MB)
            if (fileData.byteLength > 10 * 1024 * 1024) {
                throw new Error("File size exceeds maximum limit of 10MB");
            }

            this.fileProps.content = Buffer.from(fileData).toString("base64");

            if (this.fileProps.size === undefined) {
                this.fileProps.size = fileData.byteLength;
            }

            // Verify size consistency if both are provided
            if (this.fileProps.size !== fileData.byteLength) {
                throw new Error("File size property doesn't match actual data length");
            }
        }
    }

    /**
     * Converts the file properties and its content (if any) into the string payload
     * suitable for the iTerm2 `File=` command.
     * @returns The string payload (e.g., `"File=name=...;size=...:BASE64_CONTENT"` or `"File=name=...;size=..."`).
     */
    public toString(): string {
        let s = "File=";

        s += formatITerm2FileProperties(this.fileProps);

        // Only append content if it exists. props.content could be an empty string for an empty file.
        if (this.fileProps.content !== undefined) {
            s += `:${this.fileProps.content}`;
        }

        return s;
    }
}

/**
 * Represents the payload for ending an iTerm2 multipart file transfer.
 * This class is used to construct the part of the OSC 1337 sequence that is simply `FileEnd`.
 *
 * Implements {@link IITerm2Payload} for use with the generic `iTerm2` function.
 * @see {@link ITerm2MultipartFileStart} to initiate the transfer.
 * @see {@link ITerm2FilePart} for sending file chunks.
 */
export class ITerm2FileEnd implements IITerm2Payload {
    /**
     * Generates the string payload for the iTerm2 `FileEnd` command.
     * @returns The string `"FileEnd"`.
     */
    // eslint-disable-next-line class-methods-use-this
    public toString(): string {
        return "FileEnd";
    }
}

/**
 * Represents the payload for a part (chunk) of an iTerm2 multipart file transfer.
 * This class is used to construct the part of the OSC 1337 sequence that follows `FilePart=`.
 * The provided chunk must already be Base64 encoded.
 *
 * Implements {@link IITerm2Payload} for use with the generic `iTerm2` function.
 * @see {@link ITerm2MultipartFileStart} to initiate the transfer.
 * @see {@link ITerm2FileEnd} to finalize the transfer.
 */
export class ITerm2FilePart implements IITerm2Payload {
    /**
     * Constructs an `ITerm2FilePart` payload object.
     * @param base64Chunk A string containing a Base64 encoded chunk of the file data.
     * The caller is responsible for chunking the file and Base64 encoding each chunk.
     */
    public constructor(private readonly base64Chunk: string) {}

    /**
     * Converts the Base64 encoded chunk into the string payload suitable for the iTerm2 `FilePart=` command.
     * @returns The string payload (e.g., `"FilePart=U09NRURBVEE="`).
     */
    public toString(): string {
        return `FilePart=${this.base64Chunk}`;
    }
}

/**
 * Represents the payload for starting an iTerm2 multipart file transfer.
 * This class is used to construct the part of the OSC 1337 sequence that follows `MultipartFile=`.
 * This command initiates a transfer; the actual file data is sent in subsequent `FilePart` commands.
 *
 * Implements {@link IITerm2Payload} for use with the generic `iTerm2` function.
 * @see {@link ITerm2FileProps} for property details (omitting `content`).
 * @see {@link ITerm2FilePart} for sending file chunks.
 * @see {@link ITerm2FileEnd} for finalizing the transfer.
 */
export class ITerm2MultipartFileStart implements IITerm2Payload {
    /**
     * Constructs an `ITerm2MultipartFileStart` payload object.
     * @param properties Properties for the multipart file (e.g., `name`, `size`). Content is not part of this command.
     * The `name` property within `props` should be pre-Base64 encoded by the caller if it might
     * contain special characters.
     */
    public constructor(private readonly properties: Omit<ITerm2FileProperties, "content">) {}

    /**
     * Converts the file properties into the string payload suitable for the iTerm2 `MultipartFile=` command.
     * @returns The string payload (e.g., `"MultipartFile=name=...;size=..."`).
     */
    public toString(): string {
        return `MultipartFile=${formatITerm2FileProperties(this.properties)}`;
    }
}
