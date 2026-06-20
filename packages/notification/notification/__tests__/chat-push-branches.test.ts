import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discordProvider } from "../src/providers/chat/discord";
import { msTeamsProvider } from "../src/providers/chat/msteams";
import { slackProvider } from "../src/providers/chat/slack";
import { telegramProvider } from "../src/providers/chat/telegram";
import { expoProvider } from "../src/providers/push/expo";
import { fcmProvider } from "../src/providers/push/fcm";
import { webPushProvider } from "../src/providers/push/web-push";

const SLACK_CONFIG_RE = /token.*webhookUrl/;
const VAPID_CONFIG_RE = /vapidPublicKey/;

const connectMock = vi.fn();

vi.mock(import("node:http2"), () => {
    return {
        connect: (...args: unknown[]): unknown => connectMock(...args),
    };
});

const { apnsProvider } = await import("../src/providers/push/apns");

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

const textResponse = (text: string, status = 200): Response => new Response(text, { status });

const toBase64Url = (bytes: Uint8Array): string => {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCodePoint(byte);
    }

    let encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_");

    while (encoded.endsWith("=")) {
        encoded = encoded.slice(0, -1);
    }

    return encoded;
};

/** Generates a real ECDSA P-256 VAPID keypair so the JWT signing path runs for real. */
const generateVapidKeys = async (): Promise<{ privateKey: string; publicKey: string }> => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);

    return { privateKey: jwk.d ?? "", publicKey: toBase64Url(raw) };
};

/** Generates a real client push subscription so the RFC 8291 encryption path completes. */
const generateSubscription = async (endpoint: string): Promise<string> => {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
    const auth = new Uint8Array(16);

    crypto.getRandomValues(auth);

    return JSON.stringify({ endpoint, keys: { auth: toBase64Url(auth), p256dh: toBase64Url(raw) } });
};

describe("chat + push provider branches", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
        connectMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("slack", () => {
        it("webhook mode succeeds on the 'ok' body", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("ok"));

            const provider = slackProvider({ webhookUrl: "https://hooks.slack.com/services/x" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toContain("slack");
        });

        it("webhook mode fails on a non-'ok' body", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("invalid_payload", 400));

            const provider = slackProvider({ webhookUrl: "https://hooks.slack.com/services/x" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Webhook failed");
        });

        it("web API fails when no channel is provided", async () => {
            expect.assertions(2);

            const provider = slackProvider({ token: "xoxb-1" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("web API fails when the response is ok:false", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ error: "channel_not_found", ok: false }));

            const provider = slackProvider({ defaultChannel: "C1", token: "xoxb-1" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("channel_not_found");
        });

        it("factory throws when neither token nor webhookUrl is given", () => {
            expect.assertions(1);

            expect(() => slackProvider({})).toThrow(SLACK_CONFIG_RE);
        });
    });

    describe("discord", () => {
        it("maps a >=400 status to a failure carrying the body message", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ message: "Unknown Webhook" }, 404));

            const provider = discordProvider({ webhookUrl: "https://discord.com/api/webhooks/1/abc" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Unknown Webhook");
        });

        it("generates a message id when the body has none", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({}));

            const provider = discordProvider({ webhookUrl: "https://discord.com/api/webhooks/1/abc" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toContain("discord");
        });

        it("passes a thread id through in the request body", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ id: "d2" }));

            const provider = discordProvider({ webhookUrl: "https://discord.com/api/webhooks/1/abc" });
            const result = await provider.send({ text: "hi", threadId: "thread-9" });

            expect(result.success).toBe(true);

            const [, init] = fetchMock.mock.calls[0];

            expect(String(init.body)).toContain("thread-9");
        });
    });

    describe("msteams", () => {
        it("maps a >=400 status to a failure", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("nope", 400));

            const provider = msTeamsProvider({ webhookUrl: "https://outlook.office.com/webhook/x" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("HTTP 400");
        });

        it("sends blocks verbatim when provided", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(textResponse("1"));

            const provider = msTeamsProvider({ webhookUrl: "https://outlook.office.com/webhook/x" });
            const result = await provider.send({ blocks: { custom: "card" }, text: "hi" });

            expect(result.success).toBe(true);

            const [, init] = fetchMock.mock.calls[0];

            expect(String(init.body)).toContain("custom");
        });
    });

    describe("telegram", () => {
        it("fails when no chat id is available", async () => {
            expect.assertions(2);

            const provider = telegramProvider({ botToken: "1:abc" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("fails when the response is ok:false", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ description: "chat not found", ok: false }));

            const provider = telegramProvider({ botToken: "1:abc", defaultChatId: 99, parseMode: "Markdown" });
            const result = await provider.send({ text: "hi" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("chat not found");
        });
    });

    describe("fcm", () => {
        it("fails when getAccessToken throws", async () => {
            expect.assertions(2);

            const getAccessToken = vi.fn().mockRejectedValue(new Error("boom"));
            const provider = fcmProvider({ getAccessToken, projectId: "p" });
            const result = await provider.send({ body: "hi", title: "T", to: "tok" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Failed to obtain access token");
        });

        it("stringifies non-string data values and uses a static access token", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ name: "projects/p/messages/0:1" }));

            const provider = fcmProvider({ accessToken: "ya29.static", projectId: "p" });
            const result = await provider.send({ body: "hi", data: { count: 3, nested: { a: 1 } }, title: "T", to: "tok" });

            expect(result.success).toBe(true);

            const [, init] = fetchMock.mock.calls[0];

            expect(String(init.body)).toContain(String.raw`\"a\":1`);
        });

        it("succeeds overall when one token in a batch fails", async () => {
            expect.assertions(3);

            fetchMock
                .mockResolvedValueOnce(jsonResponse({ name: "projects/p/messages/ok" }))
                .mockResolvedValueOnce(jsonResponse({ error: { message: "Invalid token" } }, 400));

            const provider = fcmProvider({ accessToken: "ya29.static", projectId: "p" });
            const result = await provider.send({ body: "hi", title: "T", to: ["good", "bad"] });

            expect(result.success).toBe(true);
            expect(result.data?.recipients?.[0]?.status).toBe("sent");
            expect(result.data?.recipients?.[1]?.status).toBe("failed");
        });

        it("fails when all tokens return >=400", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ error: { message: "Invalid token" } }, 400));

            const provider = fcmProvider({ accessToken: "ya29.static", projectId: "p" });
            const result = await provider.send({ body: "hi", title: "T", to: "bad" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Invalid token");
        });
    });

    describe("expo", () => {
        it("marks a recipient failed when its ticket has status error", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(
                jsonResponse({
                    data: [
                        { id: "t1", status: "ok" },
                        { details: { error: "DeviceNotRegistered" }, status: "error" },
                    ],
                }),
            );

            const provider = expoProvider({ accessToken: "expo-token" });
            const result = await provider.send({ body: "hi", title: "T", to: ["ExpoTok1", "ExpoTok2"] });

            expect(result.success).toBe(true);
            expect(result.data?.recipients?.[1]?.status).toBe("failed");
        });

        it("fails overall when every ticket is an error", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({ data: [{ message: "bad token", status: "error" }] }));

            const provider = expoProvider({});
            const result = await provider.send({ body: "hi", to: "ExpoTok1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("bad token");
        });

        it("maps a >=400 status to a failure", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(jsonResponse({}, 400));

            const provider = expoProvider({});
            const result = await provider.send({ body: "hi", to: "ExpoTok1" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("HTTP 400");
        });
    });

    describe("web-push", () => {
        it("fails a malformed subscription without calling fetch", async () => {
            expect.assertions(2);

            const keys = await generateVapidKeys();
            const provider = webPushProvider({ vapidPrivateKey: keys.privateKey, vapidPublicKey: keys.publicKey, vapidSubject: "mailto:dev@example.com" });
            const result = await provider.send({ body: "hi", to: JSON.stringify({ endpoint: "https://push.example.com/x" }) });

            expect(result.success).toBe(false);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("maps a 404 to a terminal subscription-gone failure", async () => {
            expect.assertions(2);

            fetchMock.mockResolvedValue(new Response("", { status: 404 }));

            const keys = await generateVapidKeys();
            const subscription = await generateSubscription("https://push.example.com/sub/dead");
            const provider = webPushProvider({ vapidPrivateKey: keys.privateKey, vapidPublicKey: keys.publicKey, vapidSubject: "mailto:dev@example.com" });
            const result = await provider.send({ body: "hi", to: subscription });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Subscription gone");
        });

        it("throws when the vapid config is missing", () => {
            expect.assertions(1);

            expect(() => webPushProvider({ vapidPrivateKey: "", vapidPublicKey: "", vapidSubject: "" })).toThrow(VAPID_CONFIG_RE);
        });
    });

    describe("apns", () => {
        const signingKey = generateKeyPairSync("ec", {
            namedCurve: "P-256",
            privateKeyEncoding: { format: "pem", type: "pkcs8" },
            publicKeyEncoding: { format: "pem", type: "spki" },
        }).privateKey;

        const baseConfig = {
            bundleId: "com.example.app",
            keyId: "ABC123DEFG",
            signingKey,
            teamId: "TEAM123456",
        };

        interface FakeStream {
            emit: (event: string, ...args: unknown[]) => void;
            end: ReturnType<typeof vi.fn>;
            handlers: Record<string, (...args: unknown[]) => void>;
            on: (event: string, handler: (...args: unknown[]) => void) => FakeStream;
            requestedHeaders: Record<string, unknown>;
            setEncoding: ReturnType<typeof vi.fn>;
        }

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

        it("marks a token failed on a non-2xx status with a plain-text body", async () => {
            expect.assertions(2);

            const session = createSession([{ body: "Service Unavailable", status: 503 }]);

            connectMock.mockReturnValue(session);

            const provider = apnsProvider(baseConfig);
            const result = await provider.send({ body: "x", to: "tok" });

            expect(result.success).toBe(false);
            expect((result.error as Error).message).toContain("Service Unavailable");
        });

        it("aggregates a mixed multi-token batch", async () => {
            expect.assertions(3);

            const session = createSession([{ status: 200 }, { body: JSON.stringify({ reason: "BadDeviceToken" }), status: 400 }, { status: 200 }]);

            connectMock.mockReturnValue(session);

            const provider = apnsProvider(baseConfig);
            const result = await provider.send({ body: "x", to: ["a", "b", "c"] });

            expect(result.success).toBe(true);
            expect(result.data?.recipients).toHaveLength(3);
            expect(result.data?.recipients?.[1]?.status).toBe("failed");
        });

        it("reuses the cached jwt on a second send", async () => {
            expect.assertions(2);

            const session = createSession([{ status: 200 }, { status: 200 }]);

            connectMock.mockReturnValue(session);

            const provider = apnsProvider(baseConfig);

            await provider.send({ body: "1", to: "a" });
            await provider.send({ body: "2", to: "b" });

            const first = session.streams[0].requestedHeaders.authorization;
            const second = session.streams[1].requestedHeaders.authorization;

            expect(first).toBe(second);
            expect(connectMock).toHaveBeenCalledTimes(1);
        });
    });
});
