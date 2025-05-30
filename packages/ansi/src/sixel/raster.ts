/**
 * Represents a Sixel raster attribute.
 *
 * See ECMA-48 § 8.3.108 (PPM – Select pixel mask).
 * See DEC STD 070 § 2.4.2 (DECGRA – Set Raster Attributes).
 */
export interface SixelRaster {
    /**
     * BgColor is the background color number. This field is only used by
     * Sixel, and not PPM.
     *
     * Note: The original Go code uses BgColor, but standard Sixel raster attributes
     * (DECGRA) don't define a background color parameter this way.
     * It's typically Paspect; Px; Py. Or Pan; Pad; Ph; Pv for VT330/VT340.
     * Charm's encoder seems to use Pn1;Pn2;Pn3;Pn4 as PxlAspect;BgColor;GridW;GridH
     * which is non-standard.
     * We will follow Charm's encoder structure for Pn1; Pn2; Pn3 ; Pn4 interpretation,
     * but it's important to note this might differ from other Sixel implementations.
     * For now, this field is unused by the decoder.
     */
    backgroundColorIndex?: number; // Optional, as it's non-standard and unused by decoder.

    /**
     * GridH is the height of the pixel grid.
     */
    gridHeight: number;

    /**
     * GridW is the width of the pixel grid.
     */
    gridWidth: number;
    pixelAspectRatioDenominator: number;

    /**
     * PxlAspect is the pixel aspect ratio Px / Py.
     * Defaults to 2 (1:2 aspect ratio typically, though interpretation varies).
     * Value of 0 or 1 is 1:1. Values 2-9 are 1:N.
     */
    pixelAspectRatioNumerator: number;
}

/** Maximum width of a Sixel image, as per Charm's Go implementation. */
export const SIXEL_MAX_RASTER_WIDTH: number = 4096;

/** Maximum height of a Sixel image, as per Charm's Go implementation. */
export const SIXEL_MAX_RASTER_HEIGHT: number = 4096;

/**
 * Decodes a Sixel raster attribute string.
 * This follows Charm's interpretation of Pn1;Pn2;Pn3;Pn4 as:
 * Pn1 - Pixel Aspect Ratio Numerator (Pan)
 * Pn2 - Pixel Aspect Ratio Denominator (Pad) (Charm's encoder uses this slot for BgColor, which is non-standard for DECGRA)
 * Pn3 - Grid Width (Ph)
 * Pn4 - Grid Height (Pv)
 *
 * Standard DECGRA for VT330/VT340 is: P&lt;sub>an&lt;/sub>;P&lt;sub>ad&lt;/sub>;P&lt;sub>h&lt;/sub>;P&lt;sub>v&lt;/sub>
 * P&lt;sub>an&lt;/sub>: pixel aspect ratio numerator (default 1)
 * P&lt;sub>ad&lt;/sub>: pixel aspect ratio denominator (default 2)
 * P&lt;sub>h&lt;/sub>: page width (horizontal measure) in pixels (default terminal width)
 * P&lt;sub>v&lt;/sub>: page height (vertical measure) in pixels (default terminal height)
 *
 * We will parse according to the VT330/VT340 standard and how the encoder is setting it,
 * Pn1;Pn2;Pn3;Pn4 -> Pan;Pad;Ph;Pv.
 * @param s The raster attribute string.
 * @returns The decoded SixelRaster object.
 * @throws Error if the string is malformed.
 */
export const decodeSixelRaster = (s: string): SixelRaster => {
    const parts = s.split(";");

    if (parts.length > 4) {
        throw new Error(`sixel: too many raster attributes: ${s}`);
    }

    const nums: (number | undefined)[] = [undefined, undefined, undefined, undefined];

    for (const [index, p] of parts.entries()) {
        if (p === "") {
            // Default values will be applied later
            nums[index] = undefined;
            continue;
        }

        const n = Number.parseInt(p, 10);

        if (Number.isNaN(n)) {
            throw new TypeError(`sixel: invalid raster attribute "${p}"`);
        }

        nums[index] = n;
    }

    // Pn1 - Pixel Aspect Numerator (Pan)
    // Pn2 - Pixel Aspect Denominator (Pad)
    // Pn3 - Grid Width (Ph)
    // Pn4 - Grid Height (Pv)

    // Defaults from DEC STD 070:
    // Pan default 1, Pad default 2
    // Ph, Pv default to current window size (not handled here, use fallback if zero)
    const pixelAspectRatioNumerator = nums[0] === undefined ? 1 : nums[0];
    const pixelAspectRatioDenominator = (() => {
        const d = nums[1] ?? 2;

        if (d <= 0) {
            throw new RangeError(`sixel: Pad/denominator must be >=1, got ${d}`);
        }

        return d;
    })();

    let gridWidth = nums[2] ?? 0;
    let gridHeight = nums[3] ?? 0;

    if (gridWidth < 0 || gridHeight < 0) {
        throw new RangeError(`sixel: negative raster dimensions (${gridWidth}x${gridHeight}) are invalid`);
    }

    // Clamp to maximums if provided values are too large
    // If width/height are explicitly 0, they should use a fallback (e.g. image dimensions)
    // later in the decoding process, not SIXEL_MAX_RASTER_WIDTH/HEIGHT.
    if (gridWidth > SIXEL_MAX_RASTER_WIDTH) {
        gridWidth = SIXEL_MAX_RASTER_WIDTH;
    }

    if (gridHeight > SIXEL_MAX_RASTER_HEIGHT) {
        gridHeight = SIXEL_MAX_RASTER_HEIGHT;
    }

    return {
        gridHeight,
        // backgroundColorIndex: nums[1], // Charm's encoder uses this, but it's non-standard. Omitting for now.
        gridWidth,
        pixelAspectRatioDenominator,
        pixelAspectRatioNumerator,
    };
};
