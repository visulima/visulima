/* eslint-disable n/no-unsupported-features/node-builtins */
/*
 * Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import { SPACE_16_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
import type { ColorSupportLevel } from "./types";

const isColorSupported = (): ColorSupportLevel =>
    (() => {
        if (typeof navigator !== "undefined") {
            // @ts-expect-error - `navigator` is not defined in Node.
            if (navigator.userAgentData) {
                // @ts-expect-error - `navigator` is not defined in Node.

                const brand = navigator.userAgentData.brands.find(({ b }: { b: string }) => b === "Chromium");

                if (brand?.version > 93) {
                    return SPACE_TRUE_COLORS;
                }
            }

            // eslint-disable-next-line regexp/no-unused-capturing-group
            if (/\b(Chrome|Chromium)\//.test(navigator.userAgent)) {
                return SPACE_16_COLORS;
            }
        }

        return SPACE_MONO;
    })();

export const isStdoutColorSupported = isColorSupported;

export const isStderrColorSupported = isColorSupported;

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel } from "./types";
