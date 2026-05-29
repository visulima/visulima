import { createMocks } from "node-mocks-http";
import { describe, expect, it, vi } from "vitest";

import corsMiddleware from "../../../src/connect/middleware/cors-middleware";

describe("connect/middleware/cors-middleware", () => {
    it("should set the default access-control-allow-origin header", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            headers: { origin: "https://example.com" },
            method: "GET",
        });

        const next = vi.fn();

        await corsMiddleware()(req, res, next);

        expect(res.getHeader("Access-Control-Allow-Origin")).toBe("*");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should honor a configured origin option", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({
            headers: { origin: "https://example.com" },
            method: "GET",
        });

        await corsMiddleware({ origin: "https://allowed.test" })(req, res, vi.fn());

        expect(res.getHeader("Access-Control-Allow-Origin")).toBe("https://allowed.test");
    });
});
