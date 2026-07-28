import { afterEach, describe, expect, it, vi } from "vitest";

import { isStderrColorSupported, isStdoutColorSupported } from "../src/is-color-supported.browser";

describe("isColorSupported", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should be the same", () => {
        expect.assertions(1);

        expect(isStdoutColorSupported).toBe(isStderrColorSupported);
    });

    it("should return 0 when neither navigator nor process are defined", () => {
        expect.assertions(1);

        vi.stubGlobal("navigator", undefined);

        const result = isStdoutColorSupported();

        expect(result).toBe(0);
    });

    it("should return 3 when userAgentData reports a Chromium brand newer than 93", () => {
        expect.assertions(1);

        vi.stubGlobal("navigator", {
            userAgent: "",
            userAgentData: {
                brands: [{ brand: "Chromium", version: "120" }],
            },
        });

        expect(isStdoutColorSupported()).toBe(3);
    });

    it("should fall through to the userAgent check when the Chromium brand is 93 or older", () => {
        expect.assertions(1);

        vi.stubGlobal("navigator", {
            userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Safari/537.36",
            userAgentData: {
                brands: [{ brand: "Chromium", version: "90" }],
            },
        });

        expect(isStdoutColorSupported()).toBe(1);
    });

    it("should fall through to the userAgent check when userAgentData has no Chromium brand", () => {
        expect.assertions(1);

        vi.stubGlobal("navigator", {
            userAgent: "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            userAgentData: {
                brands: [{ brand: "Not.A/Brand", version: "99" }],
            },
        });

        expect(isStdoutColorSupported()).toBe(0);
    });

    it("should return 1 when navigator.userAgent contains \"Chrome\" or \"Chromium\"", () => {
        expect.assertions(1);

        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.93 Safari/537.36";

        vi.stubGlobal("navigator", { userAgent });

        const result = isStdoutColorSupported();

        expect(result).toBe(1);
    });
});
