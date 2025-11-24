import { describe, expect, it } from "vitest";

import { storageQueryKeys } from "../../src/core/query-keys";

describe(storageQueryKeys, () => {
    it("should have correct base key", () => {
        expect(storageQueryKeys.all).toEqual(["storage"]);
    });

    describe("files", () => {
        it("should generate all files key", () => {
            const key = storageQueryKeys.files.all("https://api.example.com");

            expect(key).toEqual(["storage", "files", "https://api.example.com"]);
        });

        it("should generate file list key", () => {
            const key = storageQueryKeys.files.list("https://api.example.com", { limit: 10, page: 1 });

            expect(key).toEqual(["storage", "files", "https://api.example.com", "list", { limit: 10, page: 1 }]);
        });

        it("should generate file detail key", () => {
            const key = storageQueryKeys.files.detail("https://api.example.com", "file-123");

            expect(key).toEqual(["storage", "files", "https://api.example.com", "detail", "file-123", undefined]);
        });

        it("should generate file detail key with transform params", () => {
            const transformParams = { height: 200, width: 100 };
            const key = storageQueryKeys.files.detail("https://api.example.com", "file-123", transformParams);

            expect(key).toEqual(["storage", "files", "https://api.example.com", "detail", "file-123", transformParams]);
        });

        it("should generate file head key", () => {
            const key = storageQueryKeys.files.head("https://api.example.com", "file-123");

            expect(key).toEqual(["storage", "files", "https://api.example.com", "file-123", "head"]);
        });

        it("should generate file meta key", () => {
            const key = storageQueryKeys.files.meta("https://api.example.com", "file-123");

            expect(key).toEqual(["storage", "files", "https://api.example.com", "file-123", "meta"]);
        });
    });

    describe("transform", () => {
        it("should generate all transform key", () => {
            const key = storageQueryKeys.transform.all("https://api.example.com");

            expect(key).toEqual(["storage", "transform", "https://api.example.com"]);
        });

        it("should generate transform file key", () => {
            const transformParams = { height: 200, width: 100 };
            const key = storageQueryKeys.transform.file("https://api.example.com", "file-123", transformParams);

            expect(key).toEqual(["storage", "transform", "https://api.example.com", "file-123", transformParams]);
        });

        it("should generate transform metadata key", () => {
            const key = storageQueryKeys.transform.metadata("https://api.example.com");

            expect(key).toEqual(["storage", "transform", "https://api.example.com", "metadata"]);
        });
    });
});
