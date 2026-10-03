import { describe, expect, it } from "vitest";

import { parseBatchDeleteBody, parseBatchIdsParameter } from "../../../src/handler/rest/rest-base";
import {
    buildFileInit,
    parseChunkHeaders,
    parseIntegerHeader,
    parseMetadataHeader,
    requirePositiveContentLength,
} from "../../../src/handler/utils/request-parser";

const headerReader =
    (headers: Record<string, string>) =>
    (name: string): string | undefined =>
        headers[name];

describe("request-parser", () => {
    describe(parseIntegerHeader, () => {
        it.each([
            ["0", 0],
            ["42", 42],
            [" 7 ", 7],
        ])("should parse %p as %p", (value, expected) => {
            expect.assertions(1);

            expect(parseIntegerHeader(value)).toBe(expected);
        });

        it.each([[null], [undefined], [""], ["12garbage"], ["-5"], ["1.5"], ["1e3"], ["abc"], ["99999999999999999999"]])("should reject %p", (value) => {
            expect.assertions(1);

            expect(parseIntegerHeader(value)).toBeUndefined();
        });
    });

    describe(requirePositiveContentLength, () => {
        it("should return a positive content length", () => {
            expect.assertions(1);

            expect(requirePositiveContentLength("10")).toBe(10);
        });

        it.each([[null], ["0"], ["12abc"], ["-1"]])("should reject %p with 400", (value) => {
            expect.assertions(1);

            expect(() => requirePositiveContentLength(value)).toThrow(expect.objectContaining({ statusCode: 400 }));
        });
    });

    describe(parseMetadataHeader, () => {
        it("should parse a JSON object", () => {
            expect.assertions(1);

            expect(parseMetadataHeader('{"owner":"me"}')).toStrictEqual({ owner: "me" });
        });

        it.each([[null], [""], ["not json"], ["null"], ["[1,2]"], ["42"], ['"text"']])("should ignore %p", (value) => {
            expect.assertions(1);

            expect(parseMetadataHeader(value)).toBeUndefined();
        });
    });

    describe(parseChunkHeaders, () => {
        it("should only accept wholly numeric chunk headers", () => {
            expect.assertions(1);

            expect(parseChunkHeaders(headerReader({ "x-chunk-offset": "5x", "x-chunked-upload": "true", "x-total-size": "12garbage" }))).toStrictEqual({
                chunkOffset: undefined,
                isChunkedUpload: true,
                totalSize: undefined,
            });
        });
    });

    describe(buildFileInit, () => {
        it("should store chunk tracking metadata for a chunked upload with a valid total size", () => {
            expect.assertions(1);

            expect(buildFileInit(headerReader({ "x-chunked-upload": "true", "x-file-metadata": '{"a":1}', "x-total-size": "10" }), 0)).toStrictEqual({
                contentType: "application/octet-stream",
                metadata: { _chunkedUpload: true, _chunks: [], _totalSize: 10, a: 1 },
                originalName: undefined,
                size: 10,
            });
        });

        it("should not start chunk tracking for an X-Total-Size with trailing garbage", () => {
            expect.assertions(1);

            expect(buildFileInit(headerReader({ "x-chunked-upload": "true", "x-total-size": "12garbage" }), 0).metadata).toStrictEqual({});
        });
    });

    describe(parseBatchIdsParameter, () => {
        it("should split and trim ids", () => {
            expect.assertions(1);

            expect(parseBatchIdsParameter(" a , b,,c ")).toStrictEqual(["a", "b", "c"]);
        });

        it("should reject an empty list with 400", () => {
            expect.assertions(1);

            expect(() => parseBatchIdsParameter(" , ")).toThrow(expect.objectContaining({ statusCode: 400 }));
        });
    });

    describe(parseBatchDeleteBody, () => {
        it.each([['["a","b"]'], ['{"ids":["a","b"]}']])("should parse %p", (body) => {
            expect.assertions(1);

            expect(parseBatchDeleteBody(body)).toStrictEqual(["a", "b"]);
        });

        it.each([["not json"], ['{"other":1}'], ["null"]])("should treat %p as a single delete", (body) => {
            expect.assertions(1);

            expect(parseBatchDeleteBody(body)).toBeUndefined();
        });

        it.each([["[]"], ['{"ids":[]}'], ["[1]"], ['["a",null]']])("should reject %p with 400", (body) => {
            expect.assertions(1);

            expect(() => parseBatchDeleteBody(body)).toThrow(expect.objectContaining({ statusCode: 400 }));
        });
    });
});
