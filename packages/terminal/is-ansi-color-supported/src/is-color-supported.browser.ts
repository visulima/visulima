/* eslint-disable n/no-unsupported-features/node-builtins */
/*
 * Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 */
import { SPACE_16_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
import type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";

// eslint-disable-next-line regexp/no-unused-capturing-group
const CHROME_CHROMIUM_RE = /\b(Chrome|Chromium)\//;

const isColorSupported = (): ColorSupportLevel =>
    (() => {
        if (typeof navigator !== "undefined") {
            // @ts-expect-error - `navigator` is not defined in Node.
            if (navigator.userAgentData) {
                // @ts-expect-error - `navigator` is not defined in Node.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                const brand = navigator.userAgentData.brands.find((entry: { brand: string }) => entry.brand === "Chromium");

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

/**
 * Browser equivalent of the server `createIsColorSupported`.
 *
 * The browser runtime cannot inspect a process' streams or CLI flags, so the
 * `stream` argument and options are accepted for API parity but ignored.
 * @returns The detected {@link ColorSupportLevel}.
 */
export const createIsColorSupported = (_stream?: "stderr" | "stdout", _options?: CreateIsColorSupportedOptions): ColorSupportLevel => isColorSupported();

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";
