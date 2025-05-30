/* eslint-disable max-classes-per-file */

import { DCS, ST } from "./constants";
import type { SixelDecoderOptions as InternalDecoderOptions } from "./sixel/decoder";
import { SixelDecoder as SixelDecoderInternal } from "./sixel/decoder";
import type { SixelEncoderOptions as InternalEncoderOptions } from "./sixel/encoder";
import { encodeToSixel } from "./sixel/encoder";
import type { RawImageData } from "./sixel/types";

// Re-export types from the sixel subdirectory for consumers

/**
 * Represents raw image data.
 * @see RawImageData from './sixel/types'
 */
export type { RawImageData, SixelColor, SixelPalette } from "./sixel/types";

/**
 * Public type for Sixel Decoder options.
 * Currently an alias to the internal {@link InternalDecoderOptions}.
 * This allows the public API to diverge in the future if needed.
 */
export type SixelDecoderOptions = InternalDecoderOptions;
// Define the public API options, which might be simpler than internal ones
// For now, they are direct aliases.

/**
 * Public type for Sixel Encoder options.
 * Currently an alias to the internal {@link InternalEncoderOptions}.
 * This allows the public API to diverge in the future if needed.
 */
export type SixelEncoderOptions = InternalEncoderOptions;

/**
 * Public Sixel Decoder class.
 * Wraps the internal SixelDecoderInternal.
 */
export class SixelDecoder {
    private readonly internalDecoder: SixelDecoderInternal;

    public constructor(options?: SixelDecoderOptions) {
        this.internalDecoder = new SixelDecoderInternal(options);
    }

    /**
     * Decodes a Sixel DCS sequence string or raw Sixel payload into an image.
     * @param sixelInput The Sixel data (either full DCS sequence or raw payload).
     * @returns The decoded image.
     */
    public decode(sixelInput: Uint8Array | string): RawImageData {
        let payload: Uint8Array | string = sixelInput;
        const inputString = typeof sixelInput === "string" ? sixelInput : new TextDecoder().decode(sixelInput);

        // Check if it's a full DCS sequence and strip it
        if (inputString.startsWith(DCS)) {
            const qIndex = inputString.indexOf("q");
            const stIndex = inputString.lastIndexOf(ST);

            if (qIndex !== -1 && stIndex !== -1 && qIndex < stIndex) {
                payload = inputString.substring(qIndex + 1, stIndex);
            }
        }

        return this.internalDecoder.decode(payload);
    }
}

/**
 * Creates a Sixel DCS sequence from a raw Sixel payload.
 *
 * DCS p1;p2;p3 q [payload] ST
 * @param payload The raw Sixel data (byte array or string).
 * @param p1 Pixel aspect ratio (default: -1, often ignored or handled by payload).
 * @param p2 Transparency mode (default: 1, 0 for true transparency can be problematic).
 * @param p3 Horizontal grid size (default: -1, usually ignored).
 * @returns The complete Sixel DCS sequence as a string.
 */
export const sixelGraphics = (payload: Uint8Array | string, p1 = -1, p2 = 1, p3 = -1): string => {
    let s = DCS;

    if (p1 >= 0) {
        s += p1.toString();
    }

    s += ";";

    if (p2 >= 0) {
        s += p2.toString();
    }

    if (p3 >= 0) {
        s += ";";
        s += p3.toString();
    }

    s += "q";
    s += typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    s += ST;

    return s;
};

/**
 * Public Sixel Encoder class.
 * Wraps the internal SixelEncoderInternal for a cleaner API.
 */
export class SixelEncoder {
    private readonly sixelEncoderOptions: SixelEncoderOptions;

    public constructor(options?: SixelEncoderOptions) {
        this.sixelEncoderOptions = options ?? {};
    }

    /**
     * Encodes an image into a Sixel DCS sequence string.
     * @param image The image to encode.
     * @param p1 Sixel parameter 1 (pixel aspect ratio, default: -1).
     * @param p2 Sixel parameter 2 (transparency mode, default: 1).
     * @param p3 Sixel parameter 3 (horizontal grid size, default: -1).
     * @returns The complete Sixel DCS sequence as a string.
     */
    public encode(image: RawImageData, p1?: number, p2?: number, p3?: number): string {
        const sixelPayload = encodeToSixel(image, this.sixelEncoderOptions);

        return sixelGraphics(sixelPayload, p1, p2, p3);
    }

    /**
     * Encodes an image directly to raw Sixel data (string).
     * This does NOT include the DCS...ST wrapper.
     * @param image The image to encode.
     * @returns Raw Sixel payload as a string.
     */
    public encodeToRawSixel(image: RawImageData): string {
        return encodeToSixel(image, this.sixelEncoderOptions);
    }
}
