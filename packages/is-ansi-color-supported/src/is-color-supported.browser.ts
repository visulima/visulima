// Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

import type { ColorSupportLevel } from "./types";

// eslint-disable-next-line import/no-unused-modules
export const isColorSupported = (): ColorSupportLevel =>
    (() => {
        if (typeof navigator !== "undefined") {
            // @ts-expect-error - `navigator` is not defined in Node.
            if (navigator.userAgentData) {
                // @ts-expect-error - `navigator` is not defined in Node.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                const brand = navigator.userAgentData.brands.find(({ b }: { b: string }) => b === "Chromium");

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (brand?.version > 93) {
                    return 3;
                }
            }

            // eslint-disable-next-line regexp/no-unused-capturing-group
            if (/\b(Chrome|Chromium)\//.test(navigator.userAgent)) {
                return 1;
            }
        }

        // when Next.JS runtime is `edge`, process.stdout is undefined, but colors output is supported
        // runtime values supported colors: `nodejs`, `edge`, `experimental-edge`
        if (typeof process !== "undefined") {
            const isNextJS = (process.env["NEXT_RUNTIME"] ?? "").includes("edge");

            return isNextJS ? 1 : 0;
        }

        return 0;
    })();

// eslint-disable-next-line import/no-unused-modules
export type { ColorSupportLevel } from "./types";
