import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PerHostLimiter, validateFinding } from "../src/validator";
import { runHttpValidation } from "../src/validator/http";

describe("runHttpValidation — request-shaping skips (no network)", () => {
    it("returns 'skipped' when the validation block has no request object", async () => {
        expect.assertions(1);

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation: { content: {} } })).resolves.toBe("skipped");
    });

    it("returns 'skipped' when the request url isn't a string", async () => {
        expect.assertions(1);

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation: { content: { request: { url: 123 } } } })).resolves.toBe("skipped");
    });

    it("returns 'skipped' when a header template references an unknown variable", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    headers: { Authorization: "Bearer {{ MISSING }}" },
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: "http://127.0.0.1:9/never",
                },
            },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("ignores non-string header values while rendering the rest", async () => {
        expect.assertions(1);

        // The numeric header value is skipped by `renderHeaders`; with only a
        // valid header left and an unreachable host we land on 'error' — proving
        // the non-string branch didn't fail the render.
        const headers: Record<string, unknown> = { "X-Numeric": 7, "X-Real": "{{ TOKEN }}" };
        const validation = {
            content: {
                request: {
                    headers,
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: "http://127.0.0.1:9/never",
                },
            },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("error");
    });

    it("returns 'skipped' when the url template references an unknown variable", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: "http://127.0.0.1:9/{{ MISSING }}",
                },
            },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("returns 'skipped' when the body template references an unknown variable", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    body: "grant_type={{ MISSING }}",
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: "http://127.0.0.1:9/never",
                },
            },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("returns 'skipped' when the response_matcher list is empty", async () => {
        expect.assertions(1);

        const validation = {
            content: { request: { response_matcher: [], url: "http://127.0.0.1:9/never" } },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("returns 'skipped' when response_matcher isn't an array", async () => {
        expect.assertions(1);

        const validation = {
            content: { request: { response_matcher: "nope", url: "http://127.0.0.1:9/never" } },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("drops report_response-only matchers and falls through to 'skipped'", async () => {
        expect.assertions(1);

        const validation = {
            content: { request: { response_matcher: [{ report_response: true }], url: "http://127.0.0.1:9/never" } },
        };

        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("skipped");
    });

    it("ignores non-object matcher entries", async () => {
        expect.assertions(1);

        const validation = {
            content: { request: { response_matcher: ["not-an-object", { status: [200], type: "StatusMatch" }], url: "http://127.0.0.1:9/never" } },
        };

        // The string entry is dropped; the StatusMatch survives → real fetch → error.
        await expect(runHttpValidation({ extraVariables: {}, secret: "x", validation })).resolves.toBe("error");
    });
});

describe("runHttpValidation — matcher branches (in-process server)", () => {
    let server: Server;
    let url: string;
    let handler: (request: IncomingMessage, response: ServerResponse) => void;

    beforeEach(async () => {
        handler = (_request, response) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end('{"ok":true}');
        };

        server = createServer((request, response) => {
            handler(request, response);
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });

        const address = server.address() as AddressInfo;

        url = `http://127.0.0.1:${String(address.port)}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    const httpValidation = (responseMatcher: unknown[]): Record<string, unknown> => {
        return {
            content: { request: { response_matcher: responseMatcher, url } },
            type: "Http",
        };
    };

    it("headerMatch returns 'skipped' when the header name isn't a string", async () => {
        expect.assertions(1);

        await expect(validateFinding(httpValidation([{ expected: ["x"], header: 5, type: "HeaderMatch" }]), "x")).resolves.toBe("skipped");
    });

    it("headerMatch passes through (verified) when the expected list is empty", async () => {
        expect.assertions(1);

        // Empty `expected` → no constraint → matcher passes → overall verified.
        await expect(validateFinding(httpValidation([{ expected: [], header: "content-type", type: "HeaderMatch" }]), "x")).resolves.toBe("verified");
    });

    it("headerMatch returns 'rejected' when the actual header value doesn't match", async () => {
        expect.assertions(1);

        await expect(validateFinding(httpValidation([{ expected: ["nope"], header: "content-type", type: "HeaderMatch" }]), "x")).resolves.toBe("rejected");
    });

    it("wordMatch with an empty words list imposes no constraint (verified)", async () => {
        expect.assertions(1);

        await expect(
            validateFinding(
                httpValidation([
                    { type: "WordMatch", words: [] },
                    { status: [200], type: "StatusMatch" },
                ]),
                "x",
            ),
        ).resolves.toBe("verified");
    });

    it("wordMatch with match_all_words rejects when one word is absent", async () => {
        expect.assertions(1);

        await expect(validateFinding(httpValidation([{ match_all_words: true, type: "WordMatch", words: ['"ok"', "missing-word"] }]), "x")).resolves.toBe(
            "rejected",
        );
    });

    it("returns 'skipped' on an unknown matcher type encountered in the loop", async () => {
        expect.assertions(1);

        // A StatusMatch marks the block as having a supported matcher (so we
        // fetch), then the unknown matcher in the same list hits the loop's
        // default branch → skipped.
        await expect(validateFinding(httpValidation([{ status: [200], type: "StatusMatch" }, { type: "Mystery" }]), "x")).resolves.toBe("skipped");
    });

    it("jsonValid returns 'error' when the body can't be read", async () => {
        expect.assertions(1);

        // Flush headers so `fetch()` resolves with a Response, then promise a
        // longer body than we deliver and destroy the socket — so the StatusMatch
        // passes (got 200) but `response.text()` throws inside `readBody`.
        handler = (_request, response) => {
            response.writeHead(200, { "Content-Length": "100", "Content-Type": "application/json" });
            response.flushHeaders();
            setTimeout(() => {
                response.socket?.destroy();
            }, 20);
        };

        await expect(validateFinding(httpValidation([{ status: [200], type: "StatusMatch" }, { type: "JsonValid" }]), "x")).resolves.toBe("error");
    });

    it("wordMatch returns 'error' when the body can't be read", async () => {
        expect.assertions(1);

        handler = (_request, response) => {
            response.writeHead(200, { "Content-Length": "100", "Content-Type": "text/plain" });
            response.flushHeaders();
            setTimeout(() => {
                response.socket?.destroy();
            }, 20);
        };

        await expect(
            validateFinding(
                httpValidation([
                    { status: [200], type: "StatusMatch" },
                    { type: "WordMatch", words: ["needle"] },
                ]),
                "x",
            ),
        ).resolves.toBe("error");
    });

    it("verifies a POST whose body template renders successfully", async () => {
        expect.assertions(2);

        let receivedBody = "";

        handler = (request, response) => {
            const chunks: Buffer[] = [];

            request.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
            });
            request.on("end", () => {
                receivedBody = Buffer.concat(chunks).toString("utf8");
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end('{"ok":true}');
            });
        };

        const validation = {
            content: {
                request: { body: "grant_type=client&token={{ TOKEN }}", method: "POST", response_matcher: [{ status: [200], type: "StatusMatch" }], url },
            },
            type: "Http",
        };

        const status = await validateFinding(validation, "fake-token-value");

        expect(status).toBe("verified");
        expect(receivedBody).toBe("grant_type=client&token=fake-token-value");
    });

    it("shares a single body read across two body-consuming matchers", async () => {
        expect.assertions(2);

        let bodyReads = 0;

        handler = (_request, response) => {
            bodyReads += 1;
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end('{"status":"active"}');
        };

        // WordMatch and JsonValid both call `readBody()`; the cache means the
        // server only renders the body once even though it's consumed twice.
        const status = await validateFinding(httpValidation([{ type: "WordMatch", words: ['"status":"active"'] }, { type: "JsonValid" }]), "x");

        expect(status).toBe("verified");
        expect(bodyReads).toBe(1);
    });

    it("returns 'error' when the caller-supplied AbortSignal fires", async () => {
        expect.assertions(1);

        // Hang the response so the request is still in-flight when we abort.
        handler = () => {
            // never responds
        };

        const controller = new AbortController();

        setTimeout(() => {
            controller.abort("caller-cancelled");
        }, 20);

        await expect(validateFinding(httpValidation([{ status: [200], type: "StatusMatch" }]), "x", controller.signal)).resolves.toBe("error");
    });
});

describe("runHttpValidation — rate-limit observation", () => {
    let server: Server;
    let url: string;
    let host: string;

    beforeEach(async () => {
        server = createServer((_request, response) => {
            response.writeHead(429, { "Content-Type": "application/json", "Retry-After": "1" });
            response.end('{"error":"rate limited"}');
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });

        const address = server.address() as AddressInfo;

        url = `http://127.0.0.1:${String(address.port)}`;
        host = `127.0.0.1:${String(address.port)}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
    });

    it("notifies the per-host limiter of a Retry-After on a 429 response", async () => {
        expect.assertions(2);

        const limiter = new PerHostLimiter();
        const validation = {
            content: { request: { response_matcher: [{ status: [200], type: "StatusMatch" }], url } },
            type: "Http",
        };

        const status = await validateFinding(validation, "x", undefined, {}, limiter);

        // StatusMatch fails (got 429), so the verdict is rejected …
        expect(status).toBe("rejected");

        // … but the limiter recorded a pause for the host before returning.
        const t0 = Date.now();

        await limiter.run(host, async () => undefined);

        expect(Date.now() - t0).toBeGreaterThanOrEqual(500);
    });
});
