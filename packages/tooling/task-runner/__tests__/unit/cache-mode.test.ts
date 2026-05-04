import { describe, expect, it } from "vitest";

import { resolveCacheMode } from "../../src/backends/factory";

describe(resolveCacheMode, () => {
    it("defaults to readwrite when nothing is set", () => {
        expect.assertions(1);

        expect(resolveCacheMode({})).toBe("readwrite");
    });

    it("honors mode when set", () => {
        expect.assertions(3);

        expect(resolveCacheMode({ mode: "read" })).toBe("read");
        expect(resolveCacheMode({ mode: "write" })).toBe("write");
        expect(resolveCacheMode({ mode: "readwrite" })).toBe("readwrite");
    });
});
