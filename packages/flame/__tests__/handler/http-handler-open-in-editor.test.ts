import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import httpHandler from "../../src/handler/http-handler";

describe("httpHandler open-in-editor integration", () => {
    it("renders editor selector and posts to provided openInEditorUrl when option is set", async () => {
        expect.assertions(3);

        const error = new Error("Boom");
        const handler = await httpHandler(error, [], { openInEditorUrl: "/__open-in-editor" });

        const { req, res } = createMocks({ method: "GET", headers: { accept: "text/html" } });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = String(res._getData());
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        expect(html).toContain("id=\"editor-selector\"");
        expect(html).toContain("/__open-in-editor");
    });

    it("does not render editor selector when openInEditorUrl is not provided", async () => {
        expect.assertions(2);

        const error = new Error("Boom");
        const handler = await httpHandler(error, [], {});

        const { req, res } = createMocks({ method: "GET", headers: { accept: "text/html" } });

        await handler(req, res);

        // eslint-disable-next-line no-underscore-dangle
        const html = String(res._getData());
        expect(String(res.getHeader("content-type"))).toBe("text/html; charset=utf-8");
        expect(html).not.toContain("id=\"editor-selector\"");
    });
});


