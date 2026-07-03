import { describe, expect, it } from "vitest";

import {
    createErrorMiddleware,
    createNegotiatedErrorHandler,
    extractStatusCode,
    fetchCreateNegotiatedErrorHandler,
    fetchHandler,
    fetchHtmlErrorHandler,
    htmlErrorHandler,
    jsonapiErrorHandler,
    jsonErrorHandler,
    jsonpErrorHandler,
    nodeHandler,
    problemErrorHandler,
    sendFetchJson,
    textErrorHandler,
    xmlErrorHandler,
} from "../src/index";

describe("@visulima/error-handler index exports", () => {
    it("re-exports the node and fetch handlers from the root entry", () => {
        expect.assertions(4);

        expect(nodeHandler).toBeTypeOf("function");
        expect(fetchHandler).toBeTypeOf("function");
        expect(fetchHtmlErrorHandler).toBeTypeOf("function");
        expect(createErrorMiddleware).toBeTypeOf("function");
    });

    it("re-exports the fetch helper utilities (previously unreachable)", () => {
        expect.assertions(2);

        expect(extractStatusCode).toBeTypeOf("function");
        expect(sendFetchJson).toBeTypeOf("function");
    });

    it("re-exports every content-type formatter and the negotiators", () => {
        expect.assertions(9);

        expect(htmlErrorHandler).toBeTypeOf("function");
        expect(jsonErrorHandler).toBeTypeOf("function");
        expect(jsonpErrorHandler).toBeTypeOf("function");
        expect(jsonapiErrorHandler).toBeTypeOf("function");
        expect(problemErrorHandler).toBeTypeOf("function");
        expect(textErrorHandler).toBeTypeOf("function");
        expect(xmlErrorHandler).toBeTypeOf("function");
        expect(createNegotiatedErrorHandler).toBeTypeOf("function");
        expect(fetchCreateNegotiatedErrorHandler).toBeTypeOf("function");
    });
});
