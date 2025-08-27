import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import xmlErrorHandler from "../../src/error-handler/xml-error-handler";

describe("xml-error-handler with normal Error", () => {
    it("renders default 500 XML response for normal Error", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({ method: "GET" });

        await xmlErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/xml; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<error>");
    });
});


