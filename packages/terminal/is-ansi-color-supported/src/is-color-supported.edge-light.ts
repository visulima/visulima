import { isStdoutColorSupported as coreIsColorSupported, SPACE_16_COLORS } from "./is-color-supported.browser";
import type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";

const isColorSupported = (): ColorSupportLevel =>
    (() => {
        // when Next.JS runtime is `edge`, process.stdout is undefined, but colors output is supported
        // runtime values supported colors: `nodejs`, `edge`, `experimental-edge`
        if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NEXT_RUNTIME?.includes("edge")) {
            return SPACE_16_COLORS;
        }

        return coreIsColorSupported();
    })();

export const isStdoutColorSupported: () => ColorSupportLevel = isColorSupported;

export const isStderrColorSupported: () => ColorSupportLevel = isColorSupported;

/**
 * Edge-runtime equivalent of the server `createIsColorSupported`.
 *
 * The edge runtime has no `tty`/`os`, so the `stream` argument and options are
 * accepted for API parity but ignored.
 * @returns The detected {@link ColorSupportLevel}.
 */
export const createIsColorSupported = (_stream?: "stderr" | "stdout", _options?: CreateIsColorSupportedOptions): ColorSupportLevel => isColorSupported();

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";
