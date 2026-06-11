import { describe, expect, it } from "vitest";

import normalizeHost from "../../src/utils/normalize-host";

describe(normalizeHost, () => {
    it("returns a bare hostname unchanged", () => {
        expect.assertions(1);

        expect(normalizeHost("example.com")).toBe("example.com");
    });

    it("strips the protocol from a URL", () => {
        expect.assertions(1);

        expect(normalizeHost("https://example.com")).toBe("example.com");
    });

    it("strips port, path, query and credentials from a URL", () => {
        expect.assertions(1);

        expect(normalizeHost("https://user:pass@example.com:8080/path?q=1")).toBe("example.com");
    });

    it("handles non-http schemes", () => {
        expect.assertions(1);

        expect(normalizeHost("ftp://files.example.com/dir")).toBe("files.example.com");
    });

    it("falls back to a protocol strip for malformed URLs", () => {
        expect.assertions(1);

        expect(normalizeHost("http://")).toBe("");
    });
});
