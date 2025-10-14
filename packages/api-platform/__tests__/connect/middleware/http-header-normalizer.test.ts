import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHeaderNormalizer from "../../../src/connect/middleware/http-header-normalizer";

const normalizeHeaderKey = (key: string) => key.toUpperCase();

describe(httpHeaderNormalizer, () => {
    it("should normalize (lowercase) all the headers and create a copy in rawHeaders", async () => {
        expect.assertions(2);

        const headers = {
            DNS: "d",
            FOO: "bar",
            tcn: "abc",
            te: "cde",
            "x-aPi-key": "123456",
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            dns: "d",
            foo: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        };

        await httpHeaderNormalizer()(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            dns: "d",
            foo: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        });
    });

    it("should normalize (canonical) all the headers and create a copy in rawHeaders", async () => {
        expect.assertions(2);

        const headers = {
            DNS: "d",
            FOO: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            Dns: "d",
            Foo: "bar",
            TCN: "abc",
            TE: "cde",
            "X-Api-Key": "123456",
        };

        await httpHeaderNormalizer({ canonical: true })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            dns: "d",
            foo: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        });
    });

    it("can use custom normalization function", async () => {
        expect.assertions(2);

        const headers = {
            DNS: "d",
            FOO: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            DNS: "d",
            FOO: "bar",
            TCN: "abc",
            TE: "cde",
            "X-API-KEY": "123456",
        };

        await httpHeaderNormalizer({
            normalizeHeaderKey,
        })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            dns: "d",
            foo: "bar",
            tcn: "abc",
            te: "cde",
            "x-api-key": "123456",
        });
    });

    // multiValueHeaders

    it("should normalize (lowercase) all the headers and create a copy in rawMultiValueHeaders", async () => {
        expect.assertions(2);

        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            cookie: ["123456", "654321"],
        };

        await httpHeaderNormalizer()(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });

    it("should normalize (canonical) all the headers and create a copy in rawMultiValueHeaders", async () => {
        expect.assertions(2);

        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            Cookie: ["123456", "654321"],
        };

        await httpHeaderNormalizer({ canonical: true })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });

    it("can use custom normalization function on multiValueHeaders", async () => {
        expect.assertions(2);

        const headers = {
            cOOkie: ["123456", "654321"],
        };

        const { req, res } = createMocks({
            headers,
            method: "GET",
        });

        const expectedHeaders = {
            COOKIE: ["123456", "654321"],
        };

        await httpHeaderNormalizer({ normalizeHeaderKey })(req, res, () => {});

        expect(req.headers).toStrictEqual(expectedHeaders);
        expect(req.rawHeaders).toStrictEqual({
            cookie: ["123456", "654321"],
        });
    });
});
