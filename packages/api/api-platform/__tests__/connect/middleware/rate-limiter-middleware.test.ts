import type { HttpError } from "http-errors";
import { createMocks } from "node-mocks-http";
import type { RateLimiterAbstract, RateLimiterRes } from "rate-limiter-flexible";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { describe, expect, it, vi } from "vitest";

import rateLimiterMiddleware from "../../../src/connect/middleware/rate-limiter-middleware";

describe("connect/middleware/rate-limiter-middleware", () => {
    it("should consume a point and set the rate-limit headers on success", async () => {
        expect.assertions(4);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.5" },
            method: "GET",
        });

        const next = vi.fn<() => void>();

        await rateLimiterMiddleware(limiter)(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.getHeader("X-RateLimit-Remaining")).toBe(4);
        expect(res.getHeader("Retry-After")).toStrictEqual(expect.any(Number));
        expect(res.getHeader("X-RateLimit-Reset")).toStrictEqual(expect.any(String));
    });

    it("should prefer request.ip when present", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "198.51.100.10";

        await rateLimiterMiddleware(limiter)(req, res, vi.fn());

        expect(consume).toHaveBeenCalledWith("198.51.100.10");
    });

    it("should fall back to x-real-ip when no other source is present", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({
            headers: { "x-real-ip": "203.0.113.7" },
            method: "GET",
        });

        delete (req as { ip?: string }).ip;

        await rateLimiterMiddleware(limiter)(req, res, vi.fn());

        expect(consume).toHaveBeenCalledWith("203.0.113.7");
    });

    it("should spread the enumerable own properties of the headers argument", async () => {
        expect.assertions(2);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.13" },
            method: "GET",
        });

        // The middleware spreads `...headers`; for a function that means its
        // enumerable own properties, not the call result.
        const headerCallback = (_limiterResponse: RateLimiterRes): Record<string, string> => {
            return {};
        };

        const headers = headerCallback as typeof headerCallback & {
            "X-Custom-Header": string;
        };

        headers["X-Custom-Header"] = "custom-value";

        await rateLimiterMiddleware(limiter, headers)(req, res, vi.fn());

        expect(res.getHeader("X-Custom-Header")).toBe("custom-value");
        expect(res.getHeader("X-RateLimit-Remaining")).toBe(4);
    });

    it("should throw a 400 when no ip can be resolved", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({ method: "GET" });

        delete (req as { ip?: string }).ip;
        delete (req.socket as { remoteAddress?: string }).remoteAddress;

        await expect(rateLimiterMiddleware(limiter)(req, res, vi.fn())).rejects.toMatchObject({
            message: "Missing IP",
            statusCode: 400,
        });
    });

    it("should throw a 429 when the limiter rejects", async () => {
        expect.assertions(2);

        const limiter = {
            consume: () => Promise.reject(new Error("limit reached")),
        } as unknown as RateLimiterAbstract;

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.9" },
            method: "GET",
        });

        let thrown: HttpError | undefined;

        try {
            await rateLimiterMiddleware(limiter)(req, res, vi.fn());
        } catch (error) {
            thrown = error as HttpError;
        }

        expect(thrown?.statusCode).toBe(429);
        expect(thrown?.message).toBe("Too Many Requests");
    });

    it("should round Retry-After up from msBeforeNext", async () => {
        expect.assertions(1);

        const limiter = {
            consume: () =>
                Promise.resolve({
                    msBeforeNext: 4200,
                    remainingPoints: 2,
                } as RateLimiterRes),
        } as unknown as RateLimiterAbstract;

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.11" },
            method: "GET",
        });

        await rateLimiterMiddleware(limiter)(req, res, vi.fn());

        expect(res.getHeader("Retry-After")).toBe(4);
    });
});
