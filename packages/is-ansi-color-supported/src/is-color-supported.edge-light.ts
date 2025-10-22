import { isStdoutColorSupported as coreIsColorSupported, SPACE_16_COLORS } from "./is-color-supported.browser";
import type { ColorSupportLevel } from "./types";

const isColorSupported = (): ColorSupportLevel =>
    (() => {
        // when Next.JS runtime is `edge`, process.stdout is undefined, but colors output is supported
        // runtime values supported colors: `nodejs`, `edge`, `experimental-edge`
        if (process.env.NEXT_RUNTIME !== undefined && process.env.NEXT_RUNTIME.includes("edge")) {
            return SPACE_16_COLORS;
        }

        return coreIsColorSupported();
    })();

export const isStdoutColorSupported = isColorSupported;

export const isStderrColorSupported = isColorSupported;

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel } from "./types";
