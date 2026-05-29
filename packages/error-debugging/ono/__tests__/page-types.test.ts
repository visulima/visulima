import { describe, expect, it } from "vitest";

import type { RequestLike } from "../src/error-inspector/page/types";
import { isExpressRequest, isHeadersObject, isIncomingMessage, isNativeRequest, runtime } from "../src/error-inspector/page/types";

const asRequest = (value: unknown): RequestLike => value as RequestLike;

describe("page/types guards", () => {
    describe(isNativeRequest, () => {
        it("returns true for a native Request (has clone method)", () => {
            expect.assertions(1);

            expect(isNativeRequest(new Request("http://localhost/"))).toBe(true);
        });

        it("returns true for a plain object exposing a clone method", () => {
            expect.assertions(1);

            const clone = () => {
                return {};
            };

            expect(isNativeRequest(asRequest({ clone }))).toBe(true);
        });

        it("returns false when no clone method is present", () => {
            expect.assertions(1);

            expect(isNativeRequest(asRequest({ method: "GET" }))).toBe(false);
        });
    });

    describe(isIncomingMessage, () => {
        it("returns true when the request has an on method and a string method", () => {
            expect.assertions(1);

            expect(isIncomingMessage(asRequest({ method: "GET", on: () => {} }))).toBe(true);
        });

        it("returns false when the method property is not a string", () => {
            expect.assertions(1);

            expect(isIncomingMessage(asRequest({ method: 123, on: () => {} }))).toBe(false);
        });

        it("returns false when there is no on method", () => {
            expect.assertions(1);

            expect(isIncomingMessage(asRequest({ method: "GET" }))).toBe(false);
        });
    });

    describe(isExpressRequest, () => {
        it("returns true for a plain object with only a string method", () => {
            expect.assertions(1);

            expect(isExpressRequest(asRequest({ method: "POST" }))).toBe(true);
        });

        it("returns false for a native Request", () => {
            expect.assertions(1);

            expect(isExpressRequest(new Request("http://localhost/"))).toBe(false);
        });

        it("returns false for an IncomingMessage-like object", () => {
            expect.assertions(1);

            expect(isExpressRequest(asRequest({ method: "GET", on: () => {} }))).toBe(false);
        });

        it("returns false when there is no string method", () => {
            expect.assertions(1);

            expect(isExpressRequest(asRequest({ url: "/x" }))).toBe(false);
        });
    });

    describe(isHeadersObject, () => {
        it("returns true for a native Headers instance", () => {
            expect.assertions(1);

            expect(isHeadersObject(new Headers())).toBe(true);
        });

        it("returns false for null", () => {
            expect.assertions(1);

            expect(isHeadersObject(null)).toBe(false);
        });

        it("returns false for a plain object lacking forEach/get", () => {
            expect.assertions(1);

            expect(isHeadersObject({})).toBe(false);
        });

        it("returns false when only forEach is present", () => {
            expect.assertions(1);

            expect(isHeadersObject({ forEach: () => {} })).toBe(false);
        });

        it("returns false for a non-object value", () => {
            expect.assertions(1);

            expect(isHeadersObject("not-an-object")).toBe(false);
        });
    });

    describe("runtime detection constants", () => {
        it("exposes boolean feature flags and a node version marker", () => {
            expect.assertions(4);

            expect([true, false]).toContain(runtime.hasNativeRequest);
            expect([true, false]).toContain(runtime.hasNativeHeaders);
            expect([true, false]).toContain(runtime.isBun);
            expect([true, false]).toContain(runtime.isDeno);
        });
    });
});
