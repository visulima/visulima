// Placeholder for Sixel specific types

// Raw image data, typically RGBA
export interface RawImageData {
    data: Uint8ClampedArray; // Each pixel is R, G, B, A
    height: number;
    width: number;
}

// Represents a Sixel band (6 scanlines)
export interface SixelBandData {
    colorMap: Record<string, number>; // Maps sixel char (e.g., '?') to palette index
    pixels: number[][]; // Array of 6 arrays, each representing a scanline's pixel on/off state
}

export interface SixelColor {
    b: number; // 0-255
    g: number; // 0-255
    r: number; // 0-255
}

export interface SixelPalette {
    colors: SixelColor[];
    maxSize: number; // Maximum number of colors this palette can hold
}
