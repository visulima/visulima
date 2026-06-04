/* eslint-disable n/no-unsupported-features/node-builtins */
/*
 * Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import { SPACE_16_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
import type { ColorSupportLevel } from "./types";

// eslint-disable-next-line regexp/no-unused-capturing-group
const CHROME_CHROMIUM_RE = /\b(Chrome|Chromium)\//;

const isColorSupported = (): ColorSupportLevel =>
    (() => {
        if (typeof navigator !== "undefined") {
            // @ts-expect-error - `navigator` is not defined in Node.
            if (navigator.userAgentData) {
                // @ts-expect-error - `navigator` is not defined in Node.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                const brand = navigator.userAgentData.brands.find(({ brand }: { brand: string }) => brand === "Chromium");

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (Number(brand?.version) > 93) {
                    return SPACE_TRUE_COLORS;
                }
            }

            if (CHROME_CHROMIUM_RE.test(navigator.userAgent)) {
                return SPACE_16_COLORS;
            }
        }

        return SPACE_MONO;
    })();

export const isStdoutColorSupported: () => ColorSupportLevel = isColorSupported;

export const isStderrColorSupported: () => ColorSupportLevel = isColorSupported;

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel } from "./types";
