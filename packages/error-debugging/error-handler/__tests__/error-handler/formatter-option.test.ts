import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { jsonErrorHandler } from "../../src/error-handler/json-error-handler";
import { jsonpErrorHandler } from "../../src/error-handler/jsonp-error-handler";
import { textErrorHandler } from "../../src/error-handler/text-error-handler";
import { xmlErrorHandler } from "../../src/error-handler/xml-error-handler";

describe("error-handler formatter option", () => {
    it("should use a custom formatter for the JSON handler", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        await jsonErrorHandler({
            formatter: () => {
                return { custom: "json-value" };
            },
        })(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"custom\":\"json-value\"}");
    });

    it("should use a custom formatter for the text handler", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        await textErrorHandler({ formatter: () => "custom-text-body" })(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("custom-text-body");
    });

    it("should use a custom formatter for the XML handler", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        await xmlErrorHandler({
            formatter: () => {
                return { error: { message: "custom-xml" } };
            },
        })(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("custom-xml");
    });

    it("should use a custom formatter for the JSONP handler", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        await jsonpErrorHandler({
            formatter: () => {
                return { custom: "jsonp-value" };
            },
        })(new Error("boom"), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("/**/ typeof callback === 'function' && callback({\"custom\":\"jsonp-value\"});");
    });

    it("should pass the negotiated status code to the formatter", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        let received: number | undefined;

        await jsonErrorHandler({
            formatter: ({ statusCode }) => {
                received = statusCode;

                return {};
            },
        })(new Error("boom"), req, res);

        expect(received).toBe(500);
    });
});
