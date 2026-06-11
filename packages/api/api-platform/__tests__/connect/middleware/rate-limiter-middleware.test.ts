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
            method: "GET",
        });

        (req as typeof req & { ip?: string }).ip = "203.0.113.5";

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

    it("should ignore spoofable forwarding headers by default", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.7" },
            method: "GET",
        });

        delete (req as { ip?: string }).ip;
        (req.socket as { remoteAddress?: string }).remoteAddress = "203.0.113.1";

        await rateLimiterMiddleware(limiter)(req, res, vi.fn());

        // The forged X-Forwarded-For must NOT be used as the key by default.
        expect(consume).toHaveBeenCalledWith("203.0.113.1");
    });

    it("should honour x-forwarded-for only when trustProxy is enabled", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({
            headers: { "x-forwarded-for": "203.0.113.7, 203.0.113.99" },
            method: "GET",
        });

        delete (req as { ip?: string }).ip;

        await rateLimiterMiddleware(limiter, { trustProxy: true })(req, res, vi.fn());

        // The first hop (client IP) is used, not the proxy.
        expect(consume).toHaveBeenCalledWith("203.0.113.7");
    });

    it("should fall back to x-real-ip when trustProxy is enabled and no forwarded-for is present", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({
            headers: { "x-real-ip": "203.0.113.7" },
            method: "GET",
        });

        delete (req as { ip?: string }).ip;

        await rateLimiterMiddleware(limiter, { trustProxy: true })(req, res, vi.fn());

        expect(consume).toHaveBeenCalledWith("203.0.113.7");
    });

    it("should use a custom keyGenerator when provided", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });
        const consume = vi.spyOn(limiter, "consume");

        const { req, res } = createMocks({
            headers: { "x-api-key": "abc123" },
            method: "GET",
        });

        await rateLimiterMiddleware(limiter, {
            keyGenerator: (request) => request.headers["x-api-key"] as string | undefined,
        })(req, res, vi.fn());

        expect(consume).toHaveBeenCalledWith("abc123");
    });

    it("should emit IETF standard headers when standardHeaders is enabled", async () => {
        expect.assertions(3);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "203.0.113.5";

        await rateLimiterMiddleware(limiter, { standardHeaders: true })(req, res, vi.fn());

        expect(res.getHeader("RateLimit-Limit")).toBe(5);
        expect(res.getHeader("RateLimit-Remaining")).toBe(4);
        expect(res.getHeader("RateLimit-Reset")).toStrictEqual(expect.any(Number));
    });

    it("should invoke the headers callback with the limiter result and apply its returned headers", async () => {
        expect.assertions(2);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "203.0.113.13";

        // The middleware invokes the callback with the rate-limit result and
        // spreads the headers it returns.
        const headers = (limiterResponse: RateLimiterRes): Record<string, string> => {
            return { "X-Custom-Header": String(limiterResponse.remainingPoints) };
        };

        await rateLimiterMiddleware(limiter, headers)(req, res, vi.fn());

        expect(res.getHeader("X-Custom-Header")).toBe("4");
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

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "203.0.113.9";

        let thrown: HttpError | undefined;

        try {
            await rateLimiterMiddleware(limiter)(req, res, vi.fn());
        } catch (error) {
            thrown = error as HttpError;
        }

        expect(thrown?.statusCode).toBe(429);
        expect(thrown?.message).toBe("Too Many Requests");
    });

    it("should not convert a downstream handler error into a 429", async () => {
        expect.assertions(1);

        const limiter = new RateLimiterMemory({ duration: 60, points: 5 });

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "203.0.113.42";

        const next = vi.fn<() => Promise<void>>(() => Promise.reject(new Error("downstream boom")));

        // The downstream error must propagate untouched, not become a 429.
        await expect(rateLimiterMiddleware(limiter)(req, res, next)).rejects.toThrow("downstream boom");
    });

    it("should round Retry-After up from msBeforeNext", async () => {
        expect.assertions(1);

        const limiter = {
            consume: () =>
                Promise.resolve({
                    consumedPoints: 3,
                    msBeforeNext: 4200,
                    remainingPoints: 2,
                } as RateLimiterRes),
        } as unknown as RateLimiterAbstract;

        const { req, res } = createMocks({ method: "GET" });

        (req as typeof req & { ip?: string }).ip = "203.0.113.11";

        await rateLimiterMiddleware(limiter)(req, res, vi.fn());

        expect(res.getHeader("Retry-After")).toBe(4);
    });
});
