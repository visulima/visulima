import { describe, expect, it } from "vitest";

import type File from "../../../../src/storage/utils/file/file";
import { parseMetadata, stringifyMetadata, validateKey, validateValue } from "../../../../src/storage/utils/file/metadata";
import partMatch from "../../../../src/storage/utils/file/part-match";
import posixDirname from "../../../../src/storage/utils/remote/posix-dirname";
import trimSlashes from "../../../../src/storage/utils/remote/trim-slashes";

describe("metadata codec", () => {
    it("should round-trip every value with its type", () => {
        expect.assertions(1);

        const metadata = {
            count: 3,
            flag: false,
            leadingZero: "01234",
            name: "bericht ü.txt",
            nested: { list: [1, "two"] },
            numericString: "42",
            ratio: 1.5,
            textTrue: "true",
        };

        expect(parseMetadata(stringifyMetadata(metadata))).toStrictEqual(metadata);
    });

    it("should keep a key without a value as undefined", () => {
        expect.assertions(1);

        expect(parseMetadata(stringifyMetadata({ empty: null, present: "yes" }))).toStrictEqual({ empty: undefined, present: "yes" });
    });

    it("should still read records stored with unquoted strings", () => {
        expect.assertions(1);

        const legacy = `name ${Buffer.from("a.txt").toString("base64")},size ${Buffer.from("12").toString("base64")},ok ${Buffer.from("true").toString("base64")}`;

        expect(parseMetadata(legacy)).toStrictEqual({ name: "a.txt", ok: true, size: 12 });
    });

    it("should reject malformed metadata", () => {
        expect.assertions(5);

        expect(() => parseMetadata("")).toThrow("Metadata string is not valid");
        expect(() => parseMetadata("   ")).toThrow("Metadata string is not valid");
        expect(() => parseMetadata("a b c")).toThrow("Metadata string is not valid");
        expect(() => parseMetadata("key notbase64!")).toThrow("Metadata string is not valid");
        expect(() => parseMetadata("dup,dup")).toThrow("Metadata string is not valid");
    });

    it("should validate keys and base64 values", () => {
        expect.assertions(6);

        expect(validateKey("")).toBe(false);
        expect(validateKey("with space")).toBe(false);
        expect(validateKey("a,b")).toBe(false);
        expect(validateKey("ü")).toBe(false);
        expect(validateValue("abc")).toBe(false);
        expect(validateValue("YWJj")).toBe(true);
    });
});

describe(partMatch, () => {
    const file = { size: 10 } as File;

    it("should accept a part inside the file and reject one past its end", () => {
        expect.assertions(3);

        expect(partMatch({ contentLength: 5, start: 5 }, file)).toBe(true);
        expect(partMatch({ contentLength: 6, start: 5 }, file)).toBe(false);
        expect(partMatch({}, file)).toBe(true);
    });

    it("should reject a part declaring a larger total size, and accept anything for a deferred length", () => {
        expect.assertions(2);

        expect(partMatch({ size: 11 }, file)).toBe(false);
        expect(partMatch({ contentLength: 1000, start: 0 }, { size: undefined } as unknown as File)).toBe(true);
    });
});

describe("remote path helpers", () => {
    it.each([
        ["/a/b/c.txt", "/a/b"],
        ["a/b/c.txt", "a/b"],
        ["/c.txt", ""],
        ["c.txt", ""],
        ["a/b/", "a"],
        ["/", ""],
    ])("posixDirname(%s) is %s", (path, expected) => {
        expect.assertions(1);

        expect(posixDirname(path)).toBe(expected);
    });

    it("should trim leading and trailing slashes only", () => {
        expect.assertions(3);

        expect(trimSlashes("//a/b//")).toBe("a/b");
        expect(trimSlashes("a/b")).toBe("a/b");
        expect(trimSlashes("///")).toBe("");
    });
});
