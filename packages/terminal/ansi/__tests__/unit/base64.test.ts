import { describe, expect, it } from "vitest";

import { encodeBase64Bytes, encodeBase64String } from "../../src/utils/base64";

describe("base64 helpers", () => {
    it("should encode a Uint8Array to Base64", () => {
        expect.assertions(2);

        expect(encodeBase64Bytes(new Uint8Array([1, 2, 3]))).toBe("AQID");
        expect(encodeBase64Bytes(new Uint8Array())).toBe("");
    });

    it("should encode a UTF-8 string to Base64", () => {
        expect.assertions(2);

        expect(encodeBase64String("foo")).toBe("Zm9v");
        // Multi-byte characters must round-trip through UTF-8 before encoding.
        expect(encodeBase64String("café")).toBe("Y2Fmw6k=");
    });
});
