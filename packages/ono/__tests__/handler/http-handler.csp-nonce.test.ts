import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHandler from "../../src/handler/http/node-handler";

describe("ono httpHandler CSP nonce option", () => {
    it("adds nonce to inline style and script tags when cspNonce is provided", async () => {
        expect.assertions(4);

        const nonce = "nonce-abc123";
        const error = new httpErrors.BadRequest("With Nonce");
        const handler = await httpHandler(error, [], { cspNonce: nonce });

        const { req, res } = createMocks({
            method: "GET",
            headers: { accept: "text/html" },
        });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = String(res._getData());

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(400);
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        expect(html).toContain(`<style nonce="${nonce}">`);
        expect(html).toContain(`<script nonce="${nonce}">`);
    });
});
