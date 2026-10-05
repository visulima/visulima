import { PassThrough, Readable } from "node:stream";

import { createRequest } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { HeaderUtilities, toHttpDate } from "../../src/utils/headers";
import { getIdFromRequestUrl, getMetadata, getRealPath, getRequestStream, readWebRequestText } from "../../src/utils/http";
import { isRetryableError } from "../../src/utils/retry";
import { Validator } from "../../src/utils/validator";

describe(toHttpDate, () => {
    it("should format dates, epoch milliseconds and date strings as HTTP-dates", () => {
        expect.assertions(3);

        expect(toHttpDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe("Fri, 02 Jan 2026 03:04:05 GMT");
        expect(toHttpDate(0)).toBe("Thu, 01 Jan 1970 00:00:00 GMT");
        expect(toHttpDate("2026-01-02T03:04:05.678Z")).toBe("Fri, 02 Jan 2026 03:04:05 GMT");
    });

    it("should leave a value that is not a date as it is", () => {
        expect.assertions(1);

        expect(toHttpDate("yesterday-ish")).toBe("yesterday-ish");
    });
});

describe("headerUtilities edge cases", () => {
    it("should percent-encode the characters RFC 8187 does not allow in filename*", () => {
        expect.assertions(1);

        expect(HeaderUtilities.createContentDisposition({ filename: "it's (1)*ü.txt", type: "inline" })).toBe(
            `inline; filename="it's (1)*_.txt"; filename*=UTF-8''it%27s%20%281%29%2A%C3%BC.txt`,
        );
    });

    it("should neutralise quotes, backslashes and line breaks in the fallback name", () => {
        expect.assertions(2);

        const header = HeaderUtilities.createContentDisposition({ filename: "a\"b\\c\r\nd.txt", type: "attachment" });

        expect(header).toMatch(/^attachment; filename="a_b_c__d\.txt"; filename\*=UTF-8''/u);
        expect(header).not.toMatch(/[\r\n]/u);
    });

    it("should leave an unparsable content type unchanged when ensuring a charset", () => {
        expect.assertions(1);

        expect(HeaderUtilities.ensureCharset("")).toBe("");
    });

    it("should join array values when converting header tuples", () => {
        expect.assertions(1);

        expect(HeaderUtilities.fromHeaders([["Vary", ["Accept", "Origin"]]] as never).get("vary")).toBe("Accept, Origin");
    });
});

describe("request helpers", () => {
    it("should take the path of an absolute request URL", () => {
        expect.assertions(2);

        expect(getRealPath(createRequest({ url: "http://example.com/files/abc?x=1" }))).toBe("/files/abc");
        expect(getRealPath(createRequest({ url: "files/abc" }))).toBe("/files/abc");
    });

    it("should read the id from the last segment, ignoring /metadata and /download", () => {
        expect.assertions(5);

        expect(getIdFromRequestUrl("http://localhost/files/asset01/metadata")).toBe("asset01");
        expect(getIdFromRequestUrl("/files/asset01.png/download", { stripExtension: true })).toBe("asset01");
        expect(getIdFromRequestUrl("/files")).toBeUndefined();
        expect(getIdFromRequestUrl("http://[bad")).toBeUndefined();
        expect(() => getIdFromRequestUrl("/files/..%2F..%2Fetc")).toThrow(expect.objectContaining({ status: 400 }));
    });

    it("should refuse a web request body declared larger than the limit before reading it", async () => {
        expect.assertions(2);

        await expect(readWebRequestText(new Request("http://localhost", { body: "x".repeat(20), headers: { "content-length": "20" }, method: "POST" }), 10)).rejects.toThrow(
            expect.objectContaining({ status: 413 }),
        );
        await expect(readWebRequestText(new Request("http://localhost"), 10)).resolves.toBe("");
    });

    it("should read JSON metadata from a parsed or a raw body, and ignore other content types", async () => {
        expect.assertions(4);

        const parsed = createRequest({ body: { a: 1 }, headers: { "content-length": "7", "content-type": "application/json" }, method: "POST" });

        await expect(getMetadata(parsed)).resolves.toStrictEqual({ a: 1 });

        const raw = Object.assign(Readable.from([Buffer.from("{\"b\":2}")]), { headers: { "content-length": "7", "content-type": "application/json" }, method: "POST" });

        await expect(getMetadata(raw as never)).resolves.toStrictEqual({ b: 2 });

        const tooBig = Object.assign(new PassThrough(), { headers: { "content-length": "100", "content-type": "application/json" }, method: "POST" });

        await expect(getMetadata(tooBig as never, 10)).rejects.toThrow("body length limit");
        await expect(getMetadata(createRequest({ headers: { "content-type": "text/plain" } }))).resolves.toStrictEqual({});
    });

    it("should turn any request into a readable body stream", async () => {
        expect.assertions(3);

        const read = async (stream: Readable): Promise<string> => {
            const chunks: Buffer[] = [];

            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk as Uint8Array));
            }

            return Buffer.concat(chunks).toString();
        };

        await expect(read(getRequestStream(new Request("http://localhost", { body: "web", method: "POST" })))).resolves.toBe("web");
        await expect(read(getRequestStream({ body: new Uint8Array(Buffer.from("bytes")) } as never))).resolves.toBe("bytes");
        await expect(read(getRequestStream({ headers: {} } as never))).resolves.toBe("");
    });
});

describe("isRetryableError edge cases", () => {
    it("should never retry an aborted operation", () => {
        expect.assertions(2);

        expect(isRetryableError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe(false);
        expect(isRetryableError(Object.assign(new Error("aborted"), { code: "ABORT_ERR" }))).toBe(false);
    });

    it("should honour a retryable flag given as a string and ignore non-errors", () => {
        expect.assertions(3);

        expect(isRetryableError(Object.assign(new Error("flaky"), { retryable: "true" }))).toBe(true);
        expect(isRetryableError(Object.assign(new Error("flaky"), { retryable: "false" }))).toBe(false);
        expect(isRetryableError("ECONNRESET")).toBe(false);
    });
});

describe("validator edge cases", () => {
    it("should accept a tuple response for a failing rule", async () => {
        expect.assertions(1);

        const validator = new Validator<{ ok: boolean }>();

        validator.add({ ok: { isValid: (value) => value.ok, response: [422, { message: "not ok" }, { "X-Reason": "ok" }] } });

        await expect(validator.verify({ ok: false })).rejects.toStrictEqual(expect.objectContaining({ code: "ValidationErrorOk", statusCode: 422 }));
    });

    it("should fall back to the unknown error response for a rule without one", async () => {
        expect.assertions(1);

        const validator = new Validator<{ ok: boolean }>();

        validator.add({ ok: { isValid: (value) => value.ok } });

        await expect(validator.verify({ ok: false })).rejects.toStrictEqual(expect.objectContaining({ statusCode: 500 }));
    });

    it("should refuse a rule without isValid", () => {
        expect.assertions(1);

        const validator = new Validator<{ ok: boolean }>();

        expect(() => validator.add({ ok: { value: 1 } })).toThrow("Validation config \"isValid\" is missing");
    });
});
