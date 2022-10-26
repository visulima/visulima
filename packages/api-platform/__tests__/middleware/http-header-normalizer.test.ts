import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHeaderNormalizer from "../../src/middleware/http-header-normalizer";

const normalizeHeaderKey = (key: string) => key.toUpperCase();

describe("httpHeaderNormalizer", () => {
    it("It should normalize (lowercase) all the headers and create a copy in rawHeaders", () => {
        const headers = {
            "x-aPi-key": "123456",
            tcn: "abc",
            te: "cde",
            DNS: "d",
            FOO: "bar",
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            dns: "d",
            foo: "bar",
        };

        httpHeaderNormalizer()(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            dns: "d",
            foo: "bar",
        });
    });

    it("It should normalize (canonical) all the headers and create a copy in rawHeaders", () => {
        const headers = {
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            DNS: "d",
            FOO: "bar",
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            "X-Api-Key": "123456",
            TCN: "abc",
            TE: "cde",
            Dns: "d",
            Foo: "bar",
        };

        httpHeaderNormalizer({ canonical: true })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            dns: "d",
            foo: "bar",
        });
    });

    it("It can use custom normalization function", () => {
        const headers = {
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            DNS: "d",
            FOO: "bar",
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            "X-API-KEY": "123456",
            TCN: "abc",
            TE: "cde",
            DNS: "d",
            FOO: "bar",
        };

        httpHeaderNormalizer({
            normalizeHeaderKey,
        })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            "x-api-key": "123456",
            tcn: "abc",
            te: "cde",
            dns: "d",
            foo: "bar",
        });
    });
});

describe("httpHeaderNormalizer", () => {
    // multiValueHeaders

    it("It should normalize (lowercase) all the headers and create a copy in rawMultiValueHeaders", () => {
        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            cookie: ["123456", "654321"],
        };

        httpHeaderNormalizer()(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });

    it("It should normalize (canonical) all the headers and create a copy in rawMultiValueHeaders", () => {
        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            Cookie: ["123456", "654321"],
        };

        httpHeaderNormalizer({ canonical: true })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });

    it("It can use custom normalization function on multiValueHeaders", () => {
        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            method: "GET",
            headers,
        });

        const expectedHeaders = {
            COOKIE: ["123456", "654321"],
        };

        httpHeaderNormalizer({ normalizeHeaderKey })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });
});
