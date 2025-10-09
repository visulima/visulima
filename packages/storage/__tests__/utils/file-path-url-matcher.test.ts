import { describe, expect, it } from "vitest";

import matcher from "../../src/utils/file-path-url-matcher";

describe("utils", () => {
    describe("filePathUrlMatcher", () => {
        it("should correctly match valid file paths and extract parameters", () => {
            expect.assertions(3);

            expect(matcher("/files/123")).toEqual({
                params: {
                    path: ["files"],
                    uuid: "123",
                },
                path: "/files/123",
            });

            expect(matcher("/files/123/")).toEqual({
                params: {
                    path: ["files"],
                    uuid: "123",
                },
                path: "/files/123/",
            });
            expect(matcher("/files/123/456")).toEqual({
                params: {
                    path: ["files", "123"],
                    uuid: "456",
                },
                path: "/files/123/456",
            });
        });

        it("should match paths that look like UUIDs", () => {
            expect.assertions(2);

            expect(matcher("/files")).toEqual({
                params: {
                    uuid: "files",
                },
                path: "/files",
            });
            expect(matcher("/files/")).toEqual({
                params: {
                    uuid: "files",
                },
                path: "/files/",
            });
        });

        it("should match metadata requests correctly", () => {
            expect.assertions(1);

            expect(matcher("/files/123-456-789/metadata")).toEqual({
                params: {
                    path: ["files"],
                    uuid: "123-456-789",
                    metadata: "metadata",
                },
                path: "/files/123-456-789/metadata",
            });
        });
    });
});
