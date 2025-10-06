import { describe, expect, it } from "vitest";

import matcher from "../../src/utils/file-path-url-matcher";

describe("utils", () => {
    describe("filePathUrlMatcher", () => {
        it("should correctly match valid file paths and extract parameters", () => {
            expect.assertions(3);

            expect(matcher("/files/123")).toEqual({
                index: 0,
                params: {
                    0: "files",
                    uuid: "123",
                },
                path: "/files/123",
            });

            expect(matcher("/files/123/")).toEqual({
                index: 0,
                params: {
                    0: "files",
                    uuid: "123",
                },
                path: "/files/123/",
            });
            expect(matcher("/files/123/456")).toEqual({
                index: 0,
                params: {
                    0: "files/123",
                    uuid: "456",
                },
                path: "/files/123/456",
            });
        });

        it("should return false for invalid file paths", () => {
            expect.assertions(2);

            expect(matcher("/files")).toBe(false);
            expect(matcher("/files/")).toBe(false);
        });
    });
});
