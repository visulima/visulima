import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { sendJson } from "../../../src/error-handler/utils/send-json";

describe(sendJson, () => {
    it("should send JSON with default content type", () => {
        expect.assertions(2);

        const { res } = createMocks({
            method: "GET",
        });

        const data = { number: 42, test: "test" };

        sendJson(res, data);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toMatchSnapshot("response-data");
        expect(res.getHeader("content-type")).toBe("application/json; charset=utf-8");
    });

    it("should send JSON with custom content type", () => {
        expect.assertions(2);

        const { res } = createMocks({
            method: "GET",
        });

        const data = { message: "custom type" };

        sendJson(res, data, "application/custom+json");

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"message\":\"custom type\"}");
        expect(res.getHeader("content-type")).toBe("application/custom+json");
    });

    it("should handle empty objects", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        sendJson(res, {});

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{}");
    });

    it("should handle arrays", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const data = [1, 2, 3, "test"];

        sendJson(res, data);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("[1,2,3,\"test\"]");
    });

    it("should handle null and undefined values", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const data = { nullValue: null, undefinedValue: undefined };

        sendJson(res, data);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"nullValue\":null}"); // undefined values are omitted by JSON.stringify
    });

    it("should handle complex nested objects", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const data = {
            items: ["item1", "item2"],
            user: {
                id: 123,
                name: "John Doe",
                preferences: {
                    notifications: true,
                    theme: "dark",
                },
            },
        };

        sendJson(res, data);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toMatchSnapshot("response-data");
    });
});
