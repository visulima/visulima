/**
 * Typed option builder for the Kitty graphics protocol.
 *
 * The protocol carries its parameters as `key=value` pairs, most of which are omitted when they
 * hold their default. Hand-assembling them means remembering both the single-letter keys and which
 * defaults are implicit; this does that once.
 * @see {@link https://sw.kovidgoyal.net/kitty/graphics-protocol/}
 */

/** What the terminal should do with the transmitted data (`a=`). */
type KittyAction = "animate" | "compose" | "delete" | "display" | "frame" | "query" | "transmit" | "transmit-display";

/** How the payload reaches the terminal (`t=`). */
type KittyTransmission = "direct" | "file" | "shared-memory" | "temp-file";

/** Pixel layout of the transmitted data (`f=`). */
type KittyFormat = "png" | "rgb" | "rgba";

/**
 * Which images a delete action removes (`d=`), as the protocol's own single letters.
 *
 * Spelled out rather than renamed: the protocol defines these letters and their exact meanings, and
 * inventing friendlier names risks implying a semantic the terminal does not have.
 */
type KittyDelete = "a" | "c" | "f" | "i" | "n" | "p" | "q" | "r" | "x" | "y" | "z";

const ACTIONS: Record<KittyAction, string> = {
    animate: "a",
    compose: "c",
    delete: "d",
    display: "p",
    frame: "f",
    query: "q",
    transmit: "t",
    "transmit-display": "T",
};

const TRANSMISSIONS: Record<KittyTransmission, string> = { direct: "d", file: "f", "shared-memory": "s", "temp-file": "t" };
const FORMATS: Record<KittyFormat, number> = { png: 100, rgb: 24, rgba: 32 };

/** Options for a Kitty graphics command. Anything left out keeps the protocol default. */
interface KittyGraphicsOptions {
    /** What to do with the data. Default `transmit`. */
    action?: KittyAction;

    /** Columns the image should occupy (`c=`). */
    columns?: number;

    /** Compress the payload with zlib (`o=z`). */
    compressed?: boolean;

    /** Which images a `delete` action removes (`d=`). Default `a` (all). */
    delete?: KittyDelete;

    /** Also free the stored image data, not just the placement (uppercases `d=`). */
    deleteResources?: boolean;

    /** Leave the cursor where it is (`C=1`). */
    doNotMoveCursor?: boolean;

    /** Pixel layout of the data (`f=`). Default `rgba`. */
    format?: KittyFormat;

    /** Display height in pixels (`h=`). */
    height?: number;

    /** Image id (`i=`). */
    id?: number;

    /** Height of the transmitted image in pixels (`v=`). */
    imageHeight?: number;

    /** Width of the transmitted image in pixels (`s=`). */
    imageWidth?: number;

    /** How many images are being transmitted (`I=`). */
    number?: number;

    /** Byte offset into the source (`O=`). */
    offset?: number;

    /** Left crop within the image, in pixels (`X=`). */
    offsetX?: number;

    /** Top crop within the image, in pixels (`Y=`). */
    offsetY?: number;

    /** Parent image id for a relative placement (`P=`). */
    parentId?: number;

    /** Parent placement id (`Q=`). */
    parentPlacementId?: number;

    /** Placement id (`p=`). */
    placementId?: number;

    /** Suppress the terminal's replies (`q=`): 1 hides OK, 2 hides OK and errors. */
    quiet?: 0 | 1 | 2;

    /** Rows the image should occupy (`r=`). */
    rows?: number;

    /** Payload size in bytes (`S=`). */
    size?: number;

    /** How the payload is delivered (`t=`). Default `direct`. */
    transmission?: KittyTransmission;

    /** Place the image without occupying cells (`U=1`). */
    virtualPlacement?: boolean;

    /** Display width in pixels (`w=`). */
    width?: number;

    /** Left edge of the source rectangle, in pixels (`x=`). */
    x?: number;

    /** Top edge of the source rectangle, in pixels (`y=`). */
    y?: number;

    /**
     * Stacking order (`z=`).
     *
     * Negative values place the image behind the text, which is how a background image is drawn —
     * so this is emitted whenever it is non-zero, not only when positive.
     */
    z?: number;
}

/**
 * Serializes Kitty graphics options into the protocol's `key=value` strings.
 *
 * Values equal to the protocol default are omitted, so the emitted sequence stays short.
 * @param options The options to serialize.
 * @returns The options, ready to hand to `kittyGraphics`.
 * @example
 * ```typescript
 * import { kittyGraphics, kittyGraphicsOptions } from "@visulima/ansi";
 *
 * kittyGraphics(base64Png, ...kittyGraphicsOptions({ action: "transmit-display", format: "png", z: -1 }));
 * ```
 */
const kittyGraphicsOptions = (options: KittyGraphicsOptions): string[] => {
    const parts: string[] = [];

    /** Numeric options that the protocol omits when zero, in emission order. */
    const positional: [string, number | undefined][] = [
        ["i", options.id],
        ["p", options.placementId],
        ["I", options.number],
        ["s", options.imageWidth],
        ["v", options.imageHeight],
    ];

    const trailing: [string, number | undefined][] = [
        ["S", options.size],
        ["O", options.offset],
    ];

    const flags: [string, boolean | undefined][] = [
        ["o=z", options.compressed],
        ["U=1", options.virtualPlacement],
        ["C=1", options.doNotMoveCursor],
    ];

    const placement: [string, number | undefined][] = [
        ["P", options.parentId],
        ["Q", options.parentPlacementId],
        ["x", options.x],
        ["y", options.y],
    ];

    const geometry: [string, number | undefined][] = [
        ["w", options.width],
        ["h", options.height],
        ["X", options.offsetX],
        ["Y", options.offsetY],
        ["c", options.columns],
        ["r", options.rows],
    ];

    const pushPositive = (pairs: [string, number | undefined][]): void => {
        for (const [key, value] of pairs) {
            if (value !== undefined && value > 0) {
                parts.push(`${key}=${String(value)}`);
            }
        }
    };

    const pushUnlessDefault = (key: string, value: number | string | undefined, fallback: number | string): void => {
        if (value !== undefined && value !== fallback) {
            parts.push(`${key}=${String(value)}`);
        }
    };

    pushUnlessDefault("f", options.format === undefined ? undefined : FORMATS[options.format], FORMATS.rgba);
    pushUnlessDefault("q", options.quiet, 0);

    pushPositive(positional);

    pushUnlessDefault("t", options.transmission === undefined ? undefined : TRANSMISSIONS[options.transmission], TRANSMISSIONS.direct);

    pushPositive(trailing);

    for (const [emitted, enabled] of flags) {
        if (enabled === true) {
            parts.push(emitted);
        }
    }

    pushPositive(placement);

    // Not `> 0`: a negative z-index draws the image behind the text, and dropping it turned a
    // background image into a foreground one.
    if (options.z !== undefined && options.z !== 0) {
        parts.push(`z=${String(options.z)}`);
    }

    pushPositive(geometry);

    if (options.delete !== undefined || options.deleteResources === true) {
        const code = options.delete ?? "a";

        parts.push(`d=${options.deleteResources === true ? code.toUpperCase() : code}`);
    }

    if (options.action !== undefined && options.action !== "transmit") {
        parts.push(`a=${ACTIONS[options.action]}`);
    }

    return parts;
};

export type { KittyAction, KittyDelete, KittyFormat, KittyGraphicsOptions, KittyTransmission };
export default kittyGraphicsOptions;
export { kittyGraphicsOptions };
