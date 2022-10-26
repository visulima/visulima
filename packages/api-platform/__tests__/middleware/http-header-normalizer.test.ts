import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHeaderNormalizer from "../../src/middleware/http-header-normalizer";

// const event = {}
const context = {
    getRemainingTimeInMillis: () => 1000,
};

describe("httpHeaderNormalizer", () => {
    it("It should normalize (lowercase) all the headers and create a copy in rawHeaders", () => {
        const headers: {
            "x-aPi-key": "123456";
            tcn: "abc";
            te: "cde";
            DNS: "d";
            FOO: "bar";
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

        const originalHeaders = { ...headers };

        httpHeaderNormalizer()(req, res, () => {});

        expect(expectedHeaders).toStrictEqual(req.headers);
        expect(originalHeaders).toStrictEqual(req.rawHeaders);
    });

    it("It should normalize (canonical) all the headers and create a copy in rawHeaders", () => {
        const headers: {
            "x-api-key": "123456";
            tcn: "abc";
            te: "cde";
            DNS: "d";
            FOO: "bar";
        };
        const originalHeaders = { ...headers };

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
        expect(req.rawHeaders).toStrictEqual(originalHeaders);
    });

    it("It can use custom normalization function", () => {
        const normalizeHeaderKey = (key) => key.toUpperCase();

        const headers: {
            "x-api-key": "123456";
            tcn: "abc";
            te: "cde";
            DNS: "d";
            FOO: "bar";
        };

        handler.use(
            httpHeaderNormalizer({
                normalizeHeaderKey,
            }),
        );

        const expectedHeaders = {
            "X-API-KEY": "123456",
            TCN: "abc",
            TE: "cde",
            DNS: "d",
            FOO: "bar",
        };

        const originalHeaders = { ...event.headers };

        const resultingEvent = await handler(event, context);

        t.deepEqual(resultingEvent.headers, expectedHeaders);
        t.deepEqual(resultingEvent.rawHeaders, originalHeaders);
    });
});

describe("httpHeaderNormalizer", () => {
    // multiValueHeaders

    it("It should normalize (lowercase) all the headers and create a copy in rawMultiValueHeaders", () => {
        const handler = middy((event, context) => event);

        handler.use(httpHeaderNormalizer());

        const event = {
            multiValueHeaders: {
                cOOkie: ["123456", "654321"],
            },
        };

        const expectedHeaders = {
            cookie: ["123456", "654321"],
        };

        const originalHeaders = { ...event.multiValueHeaders };

        const resultingEvent = await handler(event, context);

        t.deepEqual(resultingEvent.multiValueHeaders, expectedHeaders);
        t.deepEqual(resultingEvent.rawMultiValueHeaders, originalHeaders);
    });

    it("It should normalize (canonical) all the headers and create a copy in rawMultiValueHeaders", () => {
        const handler = middy((event, context) => event);

        handler.use(httpHeaderNormalizer({ canonical: true }));

        const event = {
            multiValueHeaders: {
                cOOkie: ["123456", "654321"],
            },
        };

        const expectedHeaders = {
            Cookie: ["123456", "654321"],
        };

        const originalHeaders = { ...event.multiValueHeaders };

        const resultingEvent = await handler(event, context);

        t.deepEqual(resultingEvent.multiValueHeaders, expectedHeaders);
        t.deepEqual(resultingEvent.rawMultiValueHeaders, originalHeaders);
    });

    it("It can use custom normalization function on multiValueHeaders", () => {
        const normalizeHeaderKey = (key) => key.toUpperCase();

        const handler = middy((event, context) => event);

        handler.use(
            httpHeaderNormalizer({
                normalizeHeaderKey,
            }),
        );

        const event = {
            multiValueHeaders: {
                cOOkie: ["123456", "654321"],
            },
        };

        const expectedHeaders = {
            COOKIE: ["123456", "654321"],
        };

        const originalHeaders = { ...event.multiValueHeaders };

        const resultingEvent = await handler(event, context);

        t.deepEqual(resultingEvent.multiValueHeaders, expectedHeaders);
        t.deepEqual(resultingEvent.rawMultiValueHeaders, originalHeaders);
    });
});

describe("httpHeaderNormalizer", () => {
    // Misc
    it("It should not fail if the event does not contain headers", () => {
        const handler = middy((event, context) => event);

        handler.use(httpHeaderNormalizer({}));

        const event = {
            foo: "bar",
        };

        const expectedEvent = {
            foo: "bar",
        };

        const resultingEvent = await handler(event, context);

        t.deepEqual(resultingEvent, expectedEvent);
        t.deepEqual(resultingEvent.rawHeaders);
    });
});
