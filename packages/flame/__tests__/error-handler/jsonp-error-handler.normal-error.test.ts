import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import jsonpErrorHandler from "../../src/error-handler/jsonp-error-handler";

describe("jsonp-error-handler with normal Error", () => {
    it("renders default 500 JSONP response for normal Error", async () => {
        expect.assertions(4);

        const { req, res } = createMocks({ method: "GET", url: "/?callback=myCb" });

        await jsonpErrorHandler()(new Error("boom"), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/javascript; charset=utf-8");
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        const body = res._getData();
        expect(body.startsWith("myCb(")).toBe(true);
        const json = body.slice("myCb(".length, -2);
        const parsed = JSON.parse(json) as { statusCode: number };
        expect(parsed.statusCode).toBe(500);
    });
});


