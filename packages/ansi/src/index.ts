import type { LiteralUnion } from "type-fest";

import { BEL, OSC, SEP } from "./constants";

export { default as alternativeScreen } from "./alternative-screen";

/**
 * Output a beeping sound.
 */
export const beep = "\u0007";
export { default as clear } from "./clear";
export { default as cursor } from "./cursor";
export { default as erase } from "./erase";
export { default as scroll } from "./scroll";
export { default as slice } from "./slice";

// eslint-disable-next-line no-secrets/no-secrets
/**
 * Create a clickable link.
 *
 * [Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda) Use [`supports-hyperlinks`](https://github.com/jamestalmage/supports-hyperlinks) to detect link support.
 */
export const link = (text: string, url: string): string => [OSC, "8", SEP, SEP, url, BEL, text, OSC, "8", SEP, SEP, BEL].join("");

export const image = (
    data: Uint8Array,
    options: {
        /**
         * The height is given as a number followed by a unit, or the word `'auto'`.
         * - `N`: N character cells.
         * - `Npx`: N pixels.
         * - `N%`: N percent of the session's width or height.
         * - `auto`: The image's inherent size will be used to determine an appropriate dimension.
         */
        readonly height?: LiteralUnion<"auto", number | string>;

        /**
         * @default true
         */
        readonly preserveAspectRatio?: boolean;

        /**
         * The width is given as a number followed by a unit, or the word `'auto'`.
         * - `N`: N character cells.
         * - `Npx`: N pixels.
         * - `N%`: N percent of the session's width or height.
         * - `auto`: The image's inherent size will be used to determine an appropriate dimension.
         */
        readonly width?: LiteralUnion<"auto", number | string>;
    } = {},
): string => {
    let returnValue = `${OSC}1337;File=inline=1`;

    if (options.width) {
        returnValue += `;width=${options.width}`;
    }

    if (options.height) {
        returnValue += `;height=${options.height}`;
    }

    if (options.preserveAspectRatio === false) {
        returnValue += ";preserveAspectRatio=0";
    }

    return returnValue + ":" + Buffer.from(data).toString("base64") + BEL;
};
