import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { xmlErrorHandler } from "../../src/error-handler/xml-error-handler";

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

    it("falls back to the reason phrase when the error message is empty", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({ method: "GET" });

        // eslint-disable-next-line unicorn/error-message -- intentionally empty to exercise the reason-phrase fallback
        await xmlErrorHandler()(new Error(""), req, res);

        // Empty message -> message falls back to the reason phrase ("Internal Server Error").
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("<message>Internal Server Error</message>");
    });

    it("forwards every toXml option to the serializer", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        // jstoxml may pass non-string content (e.g. numeric status codes) despite the typed signature, so coerce first.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- runtime value may be a number
        const contentMap = (content: string): string => String(content).toUpperCase();

        await xmlErrorHandler({
            toXml: {
                attributeExplicitTrue: true,
                attributeFilter: () => true,
                attributeReplacements: { "&": "&amp;" },
                contentMap,
                contentReplacements: { foo: "bar" },
                header: false,
                indent: "    ",
                selfCloseTags: false,
            },
        })(new Error("boom"), req, res);

        // header: false means no XML declaration is emitted.
        // eslint-disable-next-line no-underscore-dangle
        const data = res._getData() as string;

        expect(data.startsWith("<?xml")).toBe(false);
        // contentMap uppercases the text content of nodes.
        expect(data).toContain("BOOM");
    });
});
