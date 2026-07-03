import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ConcurrencyLimiter, PerHostLimiter, renderTemplate, validateFinding } from "../src/validator";

describe(renderTemplate, () => {
    it("substitutes a simple token", () => {
        expect.assertions(1);

        expect(renderTemplate("Bearer {{ TOKEN }}", { TOKEN: "abc" })).toBe("Bearer abc");
    });

    it("applies known filters in pipeline order", () => {
        expect.assertions(4);

        expect(renderTemplate("{{ TOKEN | downcase }}", { TOKEN: "ABC" })).toBe("abc");
        expect(renderTemplate("{{ TOKEN | upcase }}", { TOKEN: "abc" })).toBe("ABC");
        expect(renderTemplate("{{ TOKEN | b64enc }}", { TOKEN: "user:pass" })).toBe("dXNlcjpwYXNz");
        expect(renderTemplate("{{ TOKEN | b64dec }}", { TOKEN: "dXNlcjpwYXNz" })).toBe("user:pass");
    });

    it("returns undefined on unknown variable or filter", () => {
        expect.assertions(2);

        expect(renderTemplate("{{ MISSING }}", { TOKEN: "x" })).toBeUndefined();
        expect(renderTemplate("{{ TOKEN | unknownfilter }}", { TOKEN: "x" })).toBeUndefined();
    });

    it("leaves non-template text untouched", () => {
        expect.assertions(1);

        expect(renderTemplate("no variables here", { TOKEN: "x" })).toBe("no variables here");
    });
});

describe(ConcurrencyLimiter, () => {
    it("limits in-flight callers to the configured capacity", async () => {
        expect.assertions(2);

        const limiter = new ConcurrencyLimiter(2);
        let peak = 0;
        let active = 0;

        const task = async () => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise<void>((resolve) => {
                setTimeout(resolve, 20);
            });
            active -= 1;
        };

        await Promise.all(Array.from({ length: 6 }, () => limiter.run(task)));

        expect(peak).toBeLessThanOrEqual(2);
        expect(peak).toBeGreaterThan(0);
    });
});

describe(PerHostLimiter, () => {
    it("gates callers per host but not across hosts", async () => {
        expect.assertions(2);

        const limiter = new PerHostLimiter(2);
        const active = new Map<string, number>();
        const peak = new Map<string, number>();
        const spawn = (host: string) =>
            limiter.run(host, async () => {
                const current = (active.get(host) ?? 0) + 1;

                active.set(host, current);
                peak.set(host, Math.max(peak.get(host) ?? 0, current));

                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 15);
                });
                active.set(host, current - 1);
            });

        await Promise.all([...Array.from({ length: 5 }, () => spawn("a.example.com")), ...Array.from({ length: 5 }, () => spawn("b.example.com"))]);

        expect(peak.get("a.example.com")).toBeLessThanOrEqual(2);
        expect(peak.get("b.example.com")).toBeLessThanOrEqual(2);
    });

    it("pauses a host until Retry-After elapses", async () => {
        expect.assertions(1);

        const limiter = new PerHostLimiter(4);

        limiter.notifyRetryAfter("x.example.com", Date.now() + 40);

        const t0 = Date.now();

        await limiter.run("x.example.com", async () => undefined);

        expect(Date.now() - t0).toBeGreaterThanOrEqual(30);
    });

    it("derives the host (including port) from a valid URL", () => {
        expect.assertions(1);

        const limiter = new PerHostLimiter();

        expect(limiter.hostFromUrl("https://api.example.com:8443/v1/tokens")).toBe("api.example.com:8443");
    });

    it("returns a sentinel host for an unparseable URL", () => {
        expect.assertions(1);

        const limiter = new PerHostLimiter();

        expect(limiter.hostFromUrl("not a url")).toBe("__invalid__");
    });
});

describe("validateFinding — HTTP", () => {
    let server: Server;
    let url: string;
    let requests: { auth?: string; method: string; path: string }[];

    beforeEach(async () => {
        requests = [];
        server = createServer((request: IncomingMessage, response: ServerResponse) => {
            const path = request.url ?? "/";
            const auth = request.headers.authorization;

            requests.push({ auth, method: request.method ?? "", path });

            if (path.startsWith("/verified") && auth === "Bearer good-token") {
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end('{"ok":true,"user":"alice"}');

                return;
            }

            if (path.startsWith("/verified")) {
                response.writeHead(401, { "Content-Type": "application/json" });
                response.end('{"ok":false}');

                return;
            }

            if (path.startsWith("/word-match")) {
                response.writeHead(200, { "Content-Type": "application/json" });
                response.end('{"status":"active","email":"alice@example.com"}');

                return;
            }

            if (path.startsWith("/header-match")) {
                response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "X-Owner": "alice" });
                response.end('{"ok":true}');

                return;
            }

            if (path.startsWith("/json-invalid")) {
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.end("not json");

                return;
            }

            response.writeHead(404);
            response.end();
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

    it("returns 'verified' when StatusMatch hits the configured status", async () => {
        expect.assertions(2);

        const validation = {
            content: {
                request: {
                    headers: { Authorization: "Bearer {{ TOKEN }}" },
                    method: "GET",
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: `${url}/verified`,
                },
            },
            type: "Http",
        };

        const status = await validateFinding(validation, "good-token");

        expect(status).toBe("verified");
        expect(requests).toHaveLength(1);
    });

    it("returns 'rejected' when StatusMatch misses", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    headers: { Authorization: "Bearer {{ TOKEN }}" },
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: `${url}/verified`,
                },
            },
            type: "Http",
        };

        const status = await validateFinding(validation, "wrong-token");

        expect(status).toBe("rejected");
    });

    it("returns 'verified' when WordMatch finds any configured word in the body", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    response_matcher: [
                        { status: [200], type: "StatusMatch" },
                        { type: "WordMatch", words: ['"status":"active"'] },
                    ],
                    url: `${url}/word-match`,
                },
            },
            type: "Http",
        };

        await expect(validateFinding(validation, "x")).resolves.toBe("verified");
    });

    it("jsonValid verifies when response body parses as JSON", async () => {
        expect.assertions(2);

        const okValidation = {
            content: {
                request: {
                    response_matcher: [{ status: [200], type: "StatusMatch" }, { type: "JsonValid" }],
                    url: `${url}/word-match`,
                },
            },
            type: "Http",
        };
        const rejectValidation = {
            content: {
                request: {
                    response_matcher: [{ status: [200], type: "StatusMatch" }, { type: "JsonValid" }],
                    url: `${url}/json-invalid`,
                },
            },
            type: "Http",
        };

        await expect(validateFinding(okValidation, "x")).resolves.toBe("verified");
        await expect(validateFinding(rejectValidation, "x")).resolves.toBe("rejected");
    });

    it("headerMatch verifies against a case-insensitive header with optional charset", async () => {
        expect.assertions(2);

        const contentType = {
            content: {
                request: {
                    response_matcher: [{ expected: ["application/json"], header: "content-type", type: "HeaderMatch" }],
                    url: `${url}/header-match`,
                },
            },
            type: "Http",
        };
        const xOwner = {
            content: {
                request: {
                    response_matcher: [{ expected: "alice", header: "X-Owner", type: "HeaderMatch" }],
                    url: `${url}/header-match`,
                },
            },
            type: "Http",
        };

        await expect(validateFinding(contentType, "x")).resolves.toBe("verified");
        await expect(validateFinding(xOwner, "x")).resolves.toBe("verified");
    });

    it("returns 'skipped' for non-Http validator types", async () => {
        expect.assertions(1);

        const validation = { content: {}, type: "AWS" };

        await expect(validateFinding(validation, "x")).resolves.toBe("skipped");
    });

    it("returns 'skipped' when the template references an unknown variable", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    headers: { Authorization: "Bearer {{ UNDEFINED }}" },
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: `${url}/verified`,
                },
            },
            type: "Http",
        };

        await expect(validateFinding(validation, "x")).resolves.toBe("skipped");
    });

    it("returns 'skipped' when the rule has no supported matcher types", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    response_matcher: [{ type: "XmlValid" }, { type: "SomeFutureMatcher" }],
                    url: `${url}/verified`,
                },
            },
            type: "Http",
        };

        await expect(validateFinding(validation, "x")).resolves.toBe("skipped");
    });

    it("returns 'error' on a network failure", async () => {
        expect.assertions(1);

        const validation = {
            content: {
                request: {
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: "http://127.0.0.1:1/never",
                },
            },
            type: "Http",
        };

        await expect(validateFinding(validation, "x")).resolves.toBe("error");
    });

    it("injects extraVariables into template variables for depends_on_rule", async () => {
        expect.assertions(2);

        // Capture headers so we can assert the dep variable landed in the request.
        let capturedProductId: string | undefined;

        server.removeAllListeners("request");
        server.on("request", (request: IncomingMessage, response: ServerResponse) => {
            capturedProductId = Array.isArray(request.headers["x-product"]) ? request.headers["x-product"][0] : request.headers["x-product"];

            response.writeHead(200);
            response.end();
        });

        const validation = {
            content: {
                request: {
                    headers: { "x-api-key": "{{ TOKEN }}", "x-product": "{{ PRODUCTID }}" },
                    response_matcher: [{ status: [200], type: "StatusMatch" }],
                    url: `${url}/verified`,
                },
            },
            type: "Http",
        };

        const status = await validateFinding(validation, "good-token", undefined, { PRODUCTID: "abcd1234xyz0" });

        expect(status).toBe("verified");
        expect(capturedProductId).toBe("abcd1234xyz0");
    });
});

describe("validateFinding — JWT (offline)", () => {
    const minimalJwt = (headerClaims: Record<string, unknown>, payloadClaims: Record<string, unknown>): string => {
        const enc = (object: Record<string, unknown>) => Buffer.from(JSON.stringify(object)).toString("base64url");

        return `${enc(headerClaims)}.${enc(payloadClaims)}.fake-signature`;
    };

    it("returns 'verified' for a structurally valid JWT", async () => {
        expect.assertions(1);

        const token = minimalJwt({ alg: "HS256", typ: "JWT" }, { iat: 1_700_000_000, sub: "alice" });
        const status = await validateFinding({ content: {}, type: "JWT" }, token);

        expect(status).toBe("verified");
    });

    it("returns 'rejected' when the token has fewer than 3 segments", async () => {
        expect.assertions(1);

        const status = await validateFinding({ content: {}, type: "JWT" }, "not.ajwt");

        expect(status).toBe("rejected");
    });

    it("returns 'rejected' when the header isn't JSON", async () => {
        expect.assertions(1);

        const token = `not-json.${Buffer.from("{}", "utf8").toString("base64url")}.sig`;
        const status = await validateFinding({ content: {}, type: "JWT" }, token);

        expect(status).toBe("rejected");
    });

    it("returns 'rejected' when the header has no `alg` field", async () => {
        expect.assertions(1);

        const header = Buffer.from(JSON.stringify({ typ: "JWT" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
        const status = await validateFinding({ content: {}, type: "JWT" }, `${header}.${payload}.sig`);

        expect(status).toBe("rejected");
    });

    it("returns 'rejected' when the header parses to a non-object (e.g. a bare number)", async () => {
        expect.assertions(1);

        // `5` is valid JSON but not an object, so the `typeof header !== "object"` guard rejects.
        const header = Buffer.from("5", "utf8").toString("base64url");
        const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
        const status = await validateFinding({ content: {}, type: "JWT" }, `${header}.${payload}.sig`);

        expect(status).toBe("rejected");
    });
});

describe("validateFinding — dispatch", () => {
    it("returns 'skipped' when the validation block isn't an object", async () => {
        expect.assertions(2);

        await expect(validateFinding(undefined, "x")).resolves.toBe("skipped");
        // eslint-disable-next-line unicorn/no-null -- exercising the `=== null` guard that tolerates null validation fields from upstream YAML.
        await expect(validateFinding(null, "x")).resolves.toBe("skipped");
    });

    it("returns 'skipped' for HttpMultiStep validation (revocation-only)", async () => {
        expect.assertions(1);

        await expect(validateFinding({ content: {}, type: "HttpMultiStep" }, "x")).resolves.toBe("skipped");
    });

    it("returns 'skipped' for a validator type that isn't registered", async () => {
        expect.assertions(1);

        await expect(validateFinding({ content: {}, type: "SomeFutureProvider" }, "x")).resolves.toBe("skipped");
    });
});
