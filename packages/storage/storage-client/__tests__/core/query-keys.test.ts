import { describe, expect, it } from "vitest";

import storageQueryKeys from "../../src/core/query-keys";

describe(storageQueryKeys, () => {
    it("should have correct base key", () => {
        expect.assertions(1);

        expect(storageQueryKeys.all).toStrictEqual(["storage"]);
    });

    describe("files", () => {
        it("should generate all files key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.files.all("https://api.example.com");

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com"]);
        });

        it("should generate file list key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.files.list("https://api.example.com", { limit: 10, page: 1 });

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com", "list", { limit: 10, page: 1 }]);
        });

        it("should generate file detail key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.files.detail("https://api.example.com", "file-123");

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com", "detail", "file-123", undefined]);
        });

        it("should generate file detail key with transform params", () => {
            expect.assertions(1);

            const transformParams = { height: 200, width: 100 };
            const key = storageQueryKeys.files.detail("https://api.example.com", "file-123", transformParams);

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com", "detail", "file-123", transformParams]);
        });

        it("should generate file head key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.files.head("https://api.example.com", "file-123");

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com", "file-123", "head"]);
        });

        it("should generate file meta key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.files.meta("https://api.example.com", "file-123");

            expect(key).toStrictEqual(["storage", "files", "https://api.example.com", "file-123", "meta"]);
        });
    });

    describe("transform", () => {
        it("should generate all transform key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.transform.all("https://api.example.com");

            expect(key).toStrictEqual(["storage", "transform", "https://api.example.com"]);
        });

        it("should generate transform file key", () => {
            expect.assertions(1);

            const transformParams = { height: 200, width: 100 };
            const key = storageQueryKeys.transform.file("https://api.example.com", "file-123", transformParams);

            expect(key).toStrictEqual(["storage", "transform", "https://api.example.com", "file-123", transformParams]);
        });

        it("should generate transform metadata key", () => {
            expect.assertions(1);

            const key = storageQueryKeys.transform.metadata("https://api.example.com");

            expect(key).toStrictEqual(["storage", "transform", "https://api.example.com", "metadata"]);
        });
    });
});
