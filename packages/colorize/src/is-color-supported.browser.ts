import type { ColorSupportLevel } from "./types";

export const isColorSupported = (): ColorSupportLevel =>
    (() => {
        // @ts-expect-error - `navigator` is not defined in Node.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (navigator?.userAgentData) {
            // @ts-expect-error - `navigator` is not defined in Node.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
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

        return 0;
    })();
