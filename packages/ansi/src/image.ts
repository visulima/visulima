import type { LiteralUnion } from "type-fest";

import { BEL, OSC } from "./constants";

const image = (
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

export default image;
