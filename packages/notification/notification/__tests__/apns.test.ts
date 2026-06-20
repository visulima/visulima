import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock(import("node:http2"), () => {
    return {
        connect: (...args: unknown[]): unknown => connectMock(...args),
    };
});

const { apnsProvider } = await import("../src/providers/push/apns");

const BEARER_JWT_RE = /^bearer eyJ/;
const FAILED_TOKEN_RE = /BadDeviceToken/;
const TEAM_ID_RE = /teamId/;

/** A signing key in PKCS#8 PEM format — a real EC key so `createPrivateKey` succeeds. */
const signingKey = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    privateKeyEncoding: { format: "pem", type: "pkcs8" },
    publicKeyEncoding: { format: "pem", type: "spki" },
}).privateKey;

interface FakeStream {
    emit: (event: string, ...args: unknown[]) => void;
    end: ReturnType<typeof vi.fn>;
    handlers: Record<string, (...args: unknown[]) => void>;
    on: (event: string, handler: (...args: unknown[]) => void) => FakeStream;
    requestedHeaders: Record<string, unknown>;
    setEncoding: ReturnType<typeof vi.fn>;
}

/** Builds a fake HTTP/2 session whose streams emit the supplied status and body. */
const createSession = (
    responses: { body?: string; status: number }[],
): {
    close: ReturnType<typeof vi.fn>;
    closed: boolean;
    destroyed: boolean;
    on: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    streams: FakeStream[];
} => {
    const streams: FakeStream[] = [];
    let index = 0;

    const session = {
        close: vi.fn(() => {
            session.closed = true;
        }),
        closed: false,
        destroyed: false,
        on: vi.fn(),
        request: vi.fn((headers: Record<string, unknown>): FakeStream => {
            const response = responses[index] ?? { status: 200 };

            index += 1;

            const handlers: Record<string, (...args: unknown[]) => void> = {};

            const stream: FakeStream = {
                emit: (event, ...args) => {
                    handlers[event]?.(...args);
                },
                end: vi.fn(() => {
                    queueMicrotask(() => {
                        stream.emit("response", { ":status": response.status });

                        if (response.body) {
                            stream.emit("data", response.body);
                        }

                        stream.emit("end");
                    });
                }),
                handlers,
                on: (event, handler) => {
                    handlers[event] = handler;

                    return stream;
                },
                requestedHeaders: headers,
                setEncoding: vi.fn(),
            };

            streams.push(stream);

            return stream;
        }),
        streams,
    };

    return session;
};

describe("apns provider", () => {
    beforeEach(() => {
        connectMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const baseConfig = {
        bundleId: "com.example.app",
        keyId: "ABC123DEFG",
        signingKey,
        teamId: "TEAM123456",
    };

    it("posts to the sandbox host by default with the expected path and headers", async () => {
        expect.assertions(6);

        const session = createSession([{ status: 200 }]);

        connectMock.mockReturnValue(session);

        const provider = apnsProvider(baseConfig);
        const result = await provider.send({ body: "hello", title: "Hi", to: "device-token-1" });

        expect(connectMock).toHaveBeenCalledWith("https://api.sandbox.push.apple.com");
        expect(result.success).toBe(true);

        const { requestedHeaders } = session.streams[0];

        expect(requestedHeaders[":path"]).toBe("/3/device/device-token-1");
        expect(requestedHeaders["apns-topic"]).toBe("com.example.app");
        expect(String(requestedHeaders.authorization)).toMatch(BEARER_JWT_RE);

        const body = JSON.parse(session.streams[0].end.mock.calls[0][0] as string) as { aps: { alert: { body: string; title: string } } };

        expect(body.aps.alert).toStrictEqual({ body: "hello", title: "Hi" });
    });

    it("uses the production host when production is true and includes sound/badge/data", async () => {
        expect.assertions(3);

        const session = createSession([{ status: 200 }]);

        connectMock.mockReturnValue(session);

        const provider = apnsProvider({ ...baseConfig, production: true });
        const result = await provider.send({ badge: 3, body: "b", data: { custom: "x" }, sound: "ping", title: "t", to: "tok" });

        expect(connectMock).toHaveBeenCalledWith("https://api.push.apple.com");
        expect(result.success).toBe(true);

        const body = JSON.parse(session.streams[0].end.mock.calls[0][0] as string) as { aps: { badge: number; sound: string }; custom: string };

        expect(body).toStrictEqual({ aps: { alert: { body: "b", title: "t" }, badge: 3, sound: "ping" }, custom: "x" });
    });

    it("maps a non-200 response with a reason to a failure", async () => {
        expect.assertions(2);

        const session = createSession([{ body: JSON.stringify({ reason: "BadDeviceToken" }), status: 400 }]);

        connectMock.mockReturnValue(session);

        const provider = apnsProvider(baseConfig);
        const result = await provider.send({ body: "x", to: "tok" });

        expect(result.success).toBe(false);
        expect(result.error instanceof Error ? result.error.message : "").toMatch(FAILED_TOKEN_RE);
    });

    it("aggregates per-token results and succeeds when at least one token works", async () => {
        expect.assertions(4);

        const session = createSession([{ status: 200 }, { body: JSON.stringify({ reason: "Unregistered" }), status: 410 }]);

        connectMock.mockReturnValue(session);

        const provider = apnsProvider(baseConfig);
        const result = await provider.send({ body: "x", to: ["good", "bad"] });

        expect(result.success).toBe(true);
        expect(result.data?.recipients).toHaveLength(2);
        expect(result.data?.recipients?.[0]).toStrictEqual({ id: "good", messageId: "good", status: "sent" });
        expect(result.data?.recipients?.[1]?.status).toBe("failed");
    });

    it("reuses one http2 session across sends and closes it on shutdown", async () => {
        expect.assertions(3);

        const session = createSession([{ status: 200 }, { status: 200 }]);

        connectMock.mockReturnValue(session);

        const provider = apnsProvider(baseConfig);

        await provider.send({ body: "1", to: "a" });
        await provider.send({ body: "2", to: "b" });

        expect(connectMock).toHaveBeenCalledTimes(1);

        await provider.shutdown?.();

        expect(session.close).toHaveBeenCalledTimes(1);
        expect(session.closed).toBe(true);
    });

    it("throws when required options are missing", () => {
        expect.assertions(1);

        expect(() => apnsProvider({ ...baseConfig, teamId: "" })).toThrow(TEAM_ID_RE);
    });
});
