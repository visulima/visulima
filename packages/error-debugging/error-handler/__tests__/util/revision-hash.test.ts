import { describe, expect, it } from "vitest";

import revisionHash from "../../src/util/revision-hash";

const HEX_16_REGEX = /^[\da-f]{16}$/;

describe(revisionHash, () => {
    it("should return the first 16 hex chars of the input's SHA-256 digest", () => {
        expect.assertions(1);

        // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        expect(revisionHash("hello")).toBe("2cf24dba5fb0a30e");
    });

    it("should hash the empty string", () => {
        expect.assertions(1);

        // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        expect(revisionHash("")).toBe("e3b0c44298fc1c14");
    });

    it("should return a 16-character lowercase hex string", () => {
        expect.assertions(1);

        expect(revisionHash("some arbitrary content")).toMatch(HEX_16_REGEX);
    });

    it("should be deterministic for the same input", () => {
        expect.assertions(1);

        expect(revisionHash("repeat me")).toBe(revisionHash("repeat me"));
    });

    it("should produce different hashes for different inputs", () => {
        expect.assertions(1);

        expect(revisionHash("input-a")).not.toBe(revisionHash("input-b"));
    });

    it("should throw a TypeError when the input is not a string", () => {
        expect.assertions(1);

        expect(() => revisionHash(123 as unknown as string)).toThrow(TypeError);
    });
});
