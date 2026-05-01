import { describe, expect, it } from "vitest";

import { resolveCacheMode } from "../src/backends/factory";

describe(resolveCacheMode, () => {
    it("defaults to readwrite when nothing is set", () => {
        expect(resolveCacheMode({})).toBe("readwrite");
    });

    it("honors mode when set", () => {
        expect(resolveCacheMode({ mode: "read" })).toBe("read");
        expect(resolveCacheMode({ mode: "write" })).toBe("write");
        expect(resolveCacheMode({ mode: "readwrite" })).toBe("readwrite");
    });
});
