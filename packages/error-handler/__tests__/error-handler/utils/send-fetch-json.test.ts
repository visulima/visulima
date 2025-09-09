import { describe, expect, it } from "vitest";

import { sendFetchJson } from "../../../src/error-handler/utils/send-fetch-json";

describe("sendFetchJson", () => {
    it("should create Response with JSON body and default content type", () => {
        expect.assertions(3);

        const data = { test: "test", number: 42 };
        const status = 200;

        const response = sendFetchJson(data, status);

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(status);
        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    });

    it("should create Response with JSON body and custom content type", () => {
        expect.assertions(3);

        const data = { message: "custom type" };
        const status = 201;
        const contentType = "application/custom+json";

        const response = sendFetchJson(data, status, contentType);

        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBe(status);
        expect(response.headers.get("content-type")).toBe(contentType);
    });

    it("should handle empty objects", async () => {
        expect.assertions(1);

        const data = {};
        const response = sendFetchJson(data, 200);
        const body = await response.json();

        expect(body).toEqual({});
    });

    it("should handle arrays", async () => {
        expect.assertions(1);

        const data = [1, 2, 3, "test"];
        const response = sendFetchJson(data, 200);
        const body = await response.json();

        expect(body).toEqual([1, 2, 3, "test"]);
    });

    it("should handle null and undefined values", async () => {
        expect.assertions(1);

        const data = { nullValue: null, undefinedValue: undefined };
        const response = sendFetchJson(data, 200);
        const body = await response.json();

        expect(body).toEqual({ nullValue: null }); // undefined values are omitted by JSON.stringify
    });

    it("should handle complex nested objects", async () => {
        expect.assertions(1);

        const data = {
            user: {
                id: 123,
                name: "John Doe",
                preferences: {
                    theme: "dark",
                    notifications: true,
                },
            },
            items: ["item1", "item2"],
        };

        const response = sendFetchJson(data, 200);
        const body = await response.json();

        expect(body).toEqual({
            user: {
                id: 123,
                name: "John Doe",
                preferences: {
                    theme: "dark",
                    notifications: true,
                },
            },
            items: ["item1", "item2"],
        });
    });

    it("should handle different status codes", () => {
        expect.assertions(3);

        const data = { error: "Not found" };

        const response400 = sendFetchJson(data, 400);
        const response404 = sendFetchJson(data, 404);
        const response500 = sendFetchJson(data, 500);

        expect(response400.status).toBe(400);
        expect(response404.status).toBe(404);
        expect(response500.status).toBe(500);
    });

    it("should set correct headers", () => {
        expect.assertions(2);

        const data = { test: "data" };
        const response = sendFetchJson(data, 200);

        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(response.headers.has("content-length")).toBe(false); // Response doesn't set content-length automatically
    });

    it("should handle primitive values", async () => {
        expect.assertions(3);

        const stringResponse = sendFetchJson("test string", 200);
        const numberResponse = sendFetchJson(42, 200);
        const booleanResponse = sendFetchJson(true, 200);

        const stringBody = await stringResponse.json();
        const numberBody = await numberResponse.json();
        const booleanBody = await booleanResponse.json();

        expect(stringBody).toBe("test string");
        expect(numberBody).toBe(42);
        expect(booleanBody).toBe(true);
    });

    it("should handle large objects", async () => {
        expect.assertions(1);

        const largeData = {
            items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
        };

        const response = sendFetchJson(largeData, 200);
        const body = await response.json();

        expect(body.items).toHaveLength(1000);
    });
});
