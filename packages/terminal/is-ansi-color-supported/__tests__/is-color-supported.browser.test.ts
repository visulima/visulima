import { describe, expect, it } from "vitest";

import { isStderrColorSupported, isStdoutColorSupported } from "../src/is-color-supported.browser";

describe("isColorSupported", () => {
    it("should be the same", () => {
        expect.assertions(1);

        expect(isStdoutColorSupported).toBe(isStderrColorSupported);
    });

    it("should return 0 when neither navigator nor process are defined", () => {
        expect.assertions(1);

        const result = isStdoutColorSupported();

        expect(result).toBe(0);
    });

    /**
     * @vitest-environment jsdom
     */
    it("should return 1 when navigator.userAgent contains \"Chrome\" or \"Chromium\"", () => {
        expect.assertions(1);

        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36";

        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        Object.defineProperty(globalThis.navigator, "userAgent", { value: userAgent });

        const result = isStdoutColorSupported();

        expect(result).toBe(1);
    });
});
