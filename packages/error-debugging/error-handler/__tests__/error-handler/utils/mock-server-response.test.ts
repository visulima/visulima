import { describe, expect, it } from "vitest";

import MockServerResponse from "../../../src/error-handler/utils/mock-server-response";

describe("mock-server-response", () => {
    it("exposes header introspection methods on both fetch paths", () => {
        expect.assertions(4);

        const response = new MockServerResponse();

        response.setHeader("content-type", "application/json");

        expect(response.hasHeader("Content-Type")).toBe(true);
        expect(response.getHeader("content-type")).toBe("application/json");

        response.removeHeader("content-type");

        expect(response.hasHeader("content-type")).toBe(false);
        expect(response.getHeader("content-type")).toBeUndefined();
    });

    it("accumulates the written body via write and end", () => {
        expect.assertions(2);

        const response = new MockServerResponse();

        response.write("hello ");
        response.end("world");

        expect(response.body).toBe("hello world");
        expect(response.finished).toBe(true);
    });
});
