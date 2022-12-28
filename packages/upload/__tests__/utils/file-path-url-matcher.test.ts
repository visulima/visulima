import { describe, expect, it } from "vitest";

import matcher from "../../src/utils/file-path-url-matcher";

describe("utils", () => {
    describe("file-path-url-matcher", () => {
        it("should match", () => {
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

        it("should not match", () => {
            expect(matcher("/files")).toBeFalsy();
            expect(matcher("/files/")).toBeFalsy();
        });
    });
});
