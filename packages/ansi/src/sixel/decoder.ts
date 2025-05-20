import { createInitialSixelPalette, decodeSixelColor, updatePalette } from "./color";
import type { SixelRaster } from "./raster";
import { decodeSixelRaster, SIXEL_MAX_RASTER_HEIGHT, SIXEL_MAX_RASTER_WIDTH } from "./raster";
import { decodeSixelRepeat } from "./repeat";
import { CARRIAGE_RETURN, COLOR_INTRODUCER, LINE_BREAK, RASTER_ATTRIBUTE, REPEAT_INTRODUCER, SIXEL_CHAR_MAX, SIXEL_CHAR_OFFSET } from "./sixel-constants";
import type { RawImageData, SixelColor, SixelPalette } from "./types";

export interface SixelDecoderOptions {
    // Placeholder for future options, e.g., custom palette, error handling strategy
}

// Sixel command characters from specification (e.g., VT340 Screen Definition Manual)
const SIXEL_COLOR_INTRODUCER = 0x23; // '#' CharHash
const SIXEL_REPEAT_INTRODUCER = 0x21; // '!' CharExclamation
const SIXEL_RASTER_ATTRIBUTES = 0x22; // '"' CharQuote
const SIXEL_DOLLAR_SIGN = 0x24; // '$' CharDollarSign (CR)
const SIXEL_HYPHEN = 0x2d; // '-' CharMinus (CR+LF to next band)

// Character range for Sixel data characters '?' to '~'
const SIXEL_DATA_START = 0x3f; // '?'
const SIXEL_DATA_END = 0x7e; // '~'

/** Represents a decoded Sixel image. */
export interface DecodedSixelImage {
    height: number;
    palette: SixelPalette;
    pixelAspectRatioDenominator: number;
    pixelAspectRatioNumerator: number;
    pixels: Uint8Array; // Pixel data, where each byte is an index into the palette
    width: number;
}

/**
 * SixelDecoder decodes Sixel images.
 */
export class SixelDecoder {
    private data = "";

    private pos = 0;

    private width = 0;

    private height = 0;

    private imageBuffer: Uint8Array = new Uint8Array(0);

    private palette: SixelPalette = createInitialSixelPalette();

    private currentX = 0;

    private currentY = 0;

    private rasterAttributes: SixelRaster | null = null;

    constructor(private readonly options?: SixelDecoderOptions) {}

    /**
     * Resets the decoder to its initial state.
     */
    public reset(): void {
        this.data = "";
        this.pos = 0;
        this.width = 0;
        this.height = 0;
        this.imageBuffer = new Uint8Array(0);
        this.palette = createInitialSixelPalette();
        this.currentX = 0;
        this.currentY = 0;
        this.rasterAttributes = null;
    }

    /**
     * Decodes a Sixel image string.
     *
     * @param sixelData The Sixel data string (everything after DCS P...q and before ST).
     * @returns A DecodedSixelImage object.
     * @throws Error if parsing fails.
     */
    public decode(sixelData: string): DecodedSixelImage {
        this.reset();
        this.data = sixelData;

        // It's an immediate error if the input string is empty.
        if (this.data.length === 0) {
            throw new Error("Sixel image dimensions are invalid or could not be determined (empty input).");
        }

        let rasterParseAttempted = false;
        let rasterParseSuccessful = false;

        // Determine the end of the potential raster string
        let endOfRasterIndex = 0;
        for (let index = 0; index < this.data.length; index++) {
            const char = this.data[index];

            if (char === undefined) {
                break; // Ensure char is defined
            }

            const charCode = char.charCodeAt(0);

            if (
                (charCode >= SIXEL_DATA_START && charCode <= SIXEL_DATA_END) ||
                charCode === SIXEL_COLOR_INTRODUCER ||
                charCode === SIXEL_REPEAT_INTRODUCER ||
                charCode === SIXEL_DOLLAR_SIGN ||
                charCode === SIXEL_HYPHEN
            ) {
                endOfRasterIndex = index;
                break;
            }

            if (index === this.data.length - 1) {
                endOfRasterIndex = this.data.length;
            }
        }

        const potentialRaster = this.data.slice(0, Math.max(0, endOfRasterIndex)).trim();

        if (potentialRaster.length > 0) {
            rasterParseAttempted = true;

            if (potentialRaster.startsWith('"')) {
                // Standard Sixel Raster Introducer
                try {
                    this.rasterAttributes = decodeSixelRaster(potentialRaster.slice(1));
                    this.pos = endOfRasterIndex; // Consume the raster string part from main data
                    rasterParseSuccessful = true;
                } catch {
                    // Failed to parse raster string, treat as if no raster string found
                    this.rasterAttributes = null;
                    this.pos = 0; // Reset main parser position to start of data
                    // console.warn(`Sixel raster parsing error: ${(e as Error).message}`); // Optional: log error
                }
            } else {
                // String exists before Sixel data/commands but doesn't start with '"'.
                // This is not a valid Sixel raster string. Treat as no raster found.
                this.rasterAttributes = null;
                this.pos = 0; // Main parser starts from beginning of data.
            }
        } // If potentialRaster is empty, this.pos remains 0, this.rasterAttributes remains null.

        this.width = this.rasterAttributes?.gridWidth || 0;
        this.height = this.rasterAttributes?.gridHeight || 0;

        if (!rasterParseSuccessful || this.width === 0 || this.height === 0) {
            // If raster attributes were not successfully parsed, or didn't provide full dimensions, try scanning.
            // _scanForDimensions should start from this.pos (which is 0 if no raster string, or after raster string)
            const scannedSize = this._scanForDimensions();
            // Prioritize raster width/height if they were present and valid (e.g. raster provides width, scan provides height)
            this.width = this.width || scannedSize.width;
            this.height = this.height || scannedSize.height;
        }

        // Clamp to maximums if values are positive, otherwise, error check will catch them
        if (this.width > 0) {
            this.width = Math.min(this.width, SIXEL_MAX_RASTER_WIDTH);
        }
        if (this.height > 0) {
            this.height = Math.min(this.height, SIXEL_MAX_RASTER_HEIGHT);
        }

        // If, after all attempts (raster, scanning), dimensions are invalid, throw.
        // This also covers the case where the input string was not empty but yielded no dimensions.
        if (this.width <= 0 || this.height <= 0) {
            throw new Error("Sixel image dimensions are invalid or could not be determined.");
        }

        this.imageBuffer = new Uint8Array(this.width * this.height);
        this.imageBuffer.fill(0);

        let currentColorIndex = 0;

        // Main Sixel parsing loop
        while (this.pos < this.data.length) {
            const charCode = this.data.charCodeAt(this.pos);

            if (charCode >= 0x3f && charCode <= 0x7e) {
                // Sixel data chars ('?' to '~')
                const sixelPattern = charCode - SIXEL_CHAR_OFFSET;
                // console.log(`Sixel char: ${this.data[this.pos]}, pattern: ${sixelPattern.toString(2)}, currentX: ${this.currentX}, currentColorIndex: ${currentColorIndex}`); // DEBUG
                for (let bit = 0; bit < 6; bit++) {
                    if ((sixelPattern >> bit) & 1) {
                        // console.log(`  Writing pixel at (${this.currentX}, ${this.currentY + bit}) with color ${currentColorIndex}`); // DEBUG
                        this._writePixel(this.currentX, this.currentY + bit, currentColorIndex);
                    }
                }
                this.currentX++;
                this.pos++;
            } else {
                switch (this.data[this.pos]) {
                    case "#": {
                        // DECGSC - Set Color
                        const colorParseResult = decodeSixelColor(this.data, this.pos);
                        if (colorParseResult) {
                            const newColorIndex = colorParseResult.cmd.paletteIndex;
                            // Clamp selected color index to valid palette range
                            if (newColorIndex >= 0 && newColorIndex < this.palette.maxSize) {
                                currentColorIndex = newColorIndex;
                            } else if (newColorIndex >= this.palette.maxSize) {
                                // If index is out of bounds high, clamp to the max valid index
                                currentColorIndex = this.palette.maxSize - 1;
                            } // Negative indices are unlikely from parser but would retain current if they occurred

                            if (
                                colorParseResult.cmd.colorDefinition &&
                                colorParseResult.cmd.paletteIndex >= 0 &&
                                colorParseResult.cmd.paletteIndex < this.palette.maxSize
                            ) {
                                updatePalette(this.palette, colorParseResult.cmd.paletteIndex, colorParseResult.cmd.colorDefinition);
                            }
                            this.pos += colorParseResult.consumed;
                        } else {
                            // Malformed color string, try to find next safe position to continue parsing
                            this.pos = this._findNextSafePos(this.pos + 1);
                        }
                        break;
                    }

                    case "!": {
                        // DECGRI - Graphics Repeat Introducer
                        const repeatParseResult = decodeSixelRepeat(this.data, this.pos);
                        if (repeatParseResult) {
                            const { charToRepeat, count } = repeatParseResult.cmd;
                            // Ensure charToRepeat is a valid Sixel data character ('?' to '~')
                            if (charToRepeat.length === 1) {
                                const repeatCharCode = charToRepeat.charCodeAt(0);
                                if (repeatCharCode >= SIXEL_DATA_START && repeatCharCode <= SIXEL_DATA_END) {
                                    const repeatSixelPattern = repeatCharCode - SIXEL_CHAR_OFFSET;

                                    for (let r = 0; r < count; r++) {
                                        if (this.currentX >= this.width) {
                                            this.currentX = 0;
                                            this.currentY += 6;
                                            if (this.currentY >= this.height) {
                                                break;
                                            }
                                        }

                                        for (let bit = 0; bit < 6; bit++) {
                                            if ((repeatSixelPattern >> bit) & 1) {
                                                this._writePixel(this.currentX, this.currentY + bit, currentColorIndex);
                                            }
                                        }

                                        this.currentX++;
                                    }

                                    this.pos += repeatParseResult.consumed;
                                } else {
                                    // charToRepeat is invalid (e.g. empty or multiple chars)
                                    this.pos = this._findNextSafePos(this.pos + 1);
                                }
                            } else {
                                // Malformed repeat sequence
                                this.pos = this._findNextSafePos(this.pos + 1);
                            }
                        } else {
                            // Malformed repeat sequence
                            this.pos = this._findNextSafePos(this.pos + 1);
                        }

                        break;
                    }

                    case "$": {
                        // DECGCR - Graphics Carriage Return
                        this.currentX = 0;
                        this.pos++;
                        break;
                    }

                    case "-": {
                        // DECGNL - Graphics New Line
                        this.currentX = 0;
                        this.currentY += 6;
                        this.pos++;
                        break;
                    }

                    default: {
                        this.pos++;
                        break;
                    }
                }
            }

            if (this.currentX >= this.width && this.currentY < this.height) {
                this.currentX = 0;
                this.currentY += 6;
            }

            if (this.currentY >= this.height) {
                break;
            }
        }

        return {
            height: this.height,
            palette: this.palette,
            pixelAspectRatioDenominator: this.rasterAttributes?.pixelAspectRatioDenominator ?? 2,
            pixelAspectRatioNumerator: this.rasterAttributes?.pixelAspectRatioNumerator ?? 1,
            pixels: this.imageBuffer.slice(0, this.width * this.height),
            width: this.width,
        };
    }

    private _writePixel(x: number, y: number, colorIndex: number): void {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.imageBuffer[y * this.width + x] = colorIndex;
        }
    }

    private _findNextSafePos(startPos: number): number {
        let pos = startPos;
        while (pos < this.data.length) {
            const char = this.data[pos];
            if (char === undefined) {
                break;
            }
            const charCode = char.charCodeAt(0);
            if (
                (charCode >= SIXEL_DATA_START && charCode <= SIXEL_DATA_END) ||
                charCode === SIXEL_COLOR_INTRODUCER ||
                charCode === SIXEL_REPEAT_INTRODUCER ||
                charCode === SIXEL_DOLLAR_SIGN ||
                charCode === SIXEL_HYPHEN ||
                charCode === SIXEL_RASTER_ATTRIBUTES // Also safe to resume at a new raster attribute introducer
            ) {
                return pos;
            }
            pos++;
        }
        return pos;
    }

    private _scanForDimensions(): { height: number; width: number } {
        let maxX = 0;
        let maxY = 0; // Tracks the max Y reached by drawing operations or newlines
        let currentX = 0;
        let currentY = 0; // Represents the top of the current 6-pixel band

        // Use a temporary position pointer, starting from the main parser's current position
        let scanPos = this.pos;

        // Create a temporary palette just for scanning, don't modify the main one.
        // const tempPaletteForScan = createInitialSixelPalette(); // Not strictly needed for dimension scan
        // let tempCurrentColorIndex = 0;

        while (scanPos < this.data.length) {
            const char = this.data[scanPos];

            if (char === undefined) {
                break;
            }

            const charCode = char.charCodeAt(0);

            if (charCode >= SIXEL_DATA_START && charCode <= SIXEL_DATA_END) {
                // Sixel data chars
                currentX++;
                maxX = Math.max(maxX, currentX);
                maxY = Math.max(maxY, currentY + 6); // This Sixel band affects up to currentY + 5
                scanPos++;
            } else {
                switch (char) {
                    case "#": {
                        // COLOR_INTRODUCER
                        const colorParseResult = decodeSixelColor(this.data, scanPos);
                        if (colorParseResult) {
                            scanPos += colorParseResult.consumed;
                        } else {
                            scanPos = this._findNextSafePosForScan(scanPos + 1);
                        }
                        break;
                    }
                    case "!": {
                        // REPEAT_INTRODUCER
                        const repeatParseResult = decodeSixelRepeat(this.data, scanPos);
                        if (repeatParseResult) {
                            const { charToRepeat, count } = repeatParseResult.cmd;
                            if (charToRepeat.length === 1) {
                                const rCharCode = charToRepeat.charCodeAt(0);
                                if (rCharCode >= SIXEL_DATA_START && rCharCode <= SIXEL_DATA_END) {
                                    currentX += count;
                                    maxX = Math.max(maxX, currentX);
                                    maxY = Math.max(maxY, currentY + 6);
                                }
                            }
                            scanPos += repeatParseResult.consumed;
                        } else {
                            scanPos = this._findNextSafePosForScan(scanPos + 1);
                        }
                        break;
                    }
                    case "$": {
                        // CARRIAGE_RETURN
                        currentX = 0;
                        scanPos++;
                        break;
                    }
                    case "-": {
                        // LINE_BREAK
                        currentX = 0;
                        currentY += 6;
                        maxY = Math.max(maxY, currentY + 6); // After moving to new line, this is the new extent
                        scanPos++;
                        break;
                    }
                    case '"': {
                        // RASTER_ATTRIBUTE
                        // If scanning encounters a raster attribute, it means the primary raster parse
                        // either didn't happen or this is an unexpected one.
                        // For scanning dimensions, we primarily care about pixel data extent.
                        // We need to skip past this raster attribute block.
                        let endOfScanRaster = scanPos + 1;
                        for (; endOfScanRaster < this.data.length; endOfScanRaster++) {
                            const c = this.data.charCodeAt(endOfScanRaster);
                            if ((c >= SIXEL_DATA_START && c <= SIXEL_DATA_END) || ["!", "#", "$", "-"].includes(this.data[endOfScanRaster]!)) {
                                break;
                            }
                        }
                        scanPos = endOfScanRaster;
                        break;
                    }
                    default: {
                        // Unknown char, skip
                        scanPos++;
                        break;
                    }
                }
            }
        }
        // If maxX is > 0 but maxY is 0 (e.g. only "@@@"), then height is at least 6.
        // If both are 0, dimensions are 0,0.
        return { height: maxY > 0 ? maxY : maxX > 0 ? 6 : 0, width: maxX };
    }

    // Helper for _scanForDimensions to find the next Sixel command or data character
    private _findNextSafePosForScan(startPos: number): number {
        let pos = startPos;
        while (pos < this.data.length) {
            const char = this.data[pos];

            if (char === undefined) {
                break;
            }

            const charCode = char.charCodeAt(0);
            if (
                (charCode >= SIXEL_DATA_START && charCode <= SIXEL_DATA_END) || // Sixel data
                charCode === SIXEL_COLOR_INTRODUCER || // #
                charCode === SIXEL_REPEAT_INTRODUCER || // !
                charCode === SIXEL_DOLLAR_SIGN || // $
                charCode === SIXEL_HYPHEN || // -
                charCode === SIXEL_RASTER_ATTRIBUTES // " (start of another Sixel sequence)
            ) {
                return pos;
            }
            pos++;
        }

        return pos; // End of data
    }
}
