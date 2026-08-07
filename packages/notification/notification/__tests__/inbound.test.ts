import { describe, expect, it } from "vitest";

import { createDiscordInbound } from "../src/inbound/channels/discord";
import { createSlackInbound } from "../src/inbound/channels/slack";
import { createTelegramInbound } from "../src/inbound/channels/telegram";
import { createTwilioInbound } from "../src/inbound/channels/twilio";
import { createInboundRouter } from "../src/inbound/router";
import type { InboundMessage } from "../src/inbound/types";
import { mockProvider } from "../src/providers/mock/provider";

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const toBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";

    for (const byte of new Uint8Array(buffer)) {
        binary += String.fromCodePoint(byte);
    }

    return btoa(binary);
};

const hmac = async (secret: string, message: string, hash: "SHA-1" | "SHA-256"): Promise<ArrayBuffer> => {
    const key = await globalThis.crypto.subtle.importKey("raw", encoder.encode(secret), { hash, name: "HMAC" }, false, ["sign"]);

    return globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
};

describe(createSlackInbound, () => {
    const secret = "slack-signing-secret";

    const signedRequest = async (body: string, contentType: string): Promise<Request> => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = `v0=${toHex(await hmac(secret, `v0:${timestamp}:${body}`, "SHA-256"))}`;

        return new Request("https://example.com/webhooks/slack", {
            body,
            headers: { "content-type": contentType, "x-slack-request-timestamp": timestamp, "x-slack-signature": signature },
            method: "POST",
        });
    };

    it("answers the url_verification handshake with the challenge", async () => {
        expect.assertions(2);

        const channel = createSlackInbound({ onMessage: () => undefined, signingSecret: secret });
        const body = JSON.stringify({ challenge: "abc123", type: "url_verification" });
        const response = await channel.handle(await signedRequest(body, "application/json"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({ challenge: "abc123" });
    });

    it("parses an Events API message and acknowledges with 200", async () => {
        expect.assertions(4);

        let received: InboundMessage | undefined;
        const channel = createSlackInbound({
            onMessage: (message) => {
                received = message;
            },
            signingSecret: secret,
        });
        const body = JSON.stringify({
            event: { channel: "C1", text: "hello bot", ts: "1700000000.0001", type: "app_mention", user: "U1" },
            event_id: "Ev1",
            type: "event_callback",
        });
        const response = await channel.handle(await signedRequest(body, "application/json"));

        expect(response.status).toBe(200);
        expect(received?.type).toBe("message");
        expect(received?.text).toBe("hello bot");
        expect(received?.conversationId).toBe("C1");
    });

    it("serialises a slash-command reply into the JSON response", async () => {
        expect.assertions(2);

        const channel = createSlackInbound({
            onMessage: () => {
                return { text: "pong" };
            },
            signingSecret: secret,
        });
        const body = new URLSearchParams({ channel_id: "C9", command: "/ping", text: "", user_id: "U2" }).toString();
        const response = await channel.handle(await signedRequest(body, "application/x-www-form-urlencoded"));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ text: "pong" });
    });

    it("replies to an Events API message out-of-band through the provider", async () => {
        expect.assertions(3);

        const provider = mockProvider({ channel: "chat", id: "slack" });
        const channel = createSlackInbound({
            onMessage: async (_message, context) => {
                await context.reply("hello back");
            },
            provider,
            signingSecret: secret,
        });
        const body = JSON.stringify({
            event: { channel: "C1", text: "hi", ts: "1700000000.0001", type: "app_mention", user: "U1" },
            event_id: "Ev2",
            type: "event_callback",
        });
        const response = await channel.handle(await signedRequest(body, "application/json"));
        const sent = provider.getInstance?.().last();

        expect(response.status).toBe(200);
        expect(sent?.payload).toMatchObject({ text: "hello back", to: "C1" });
        expect((sent?.payload as { threadId?: string }).threadId).toBe("1700000000.0001");
    });

    it("rejects a tampered signature with 401", async () => {
        expect.assertions(1);

        const channel = createSlackInbound({ onMessage: () => undefined, signingSecret: secret });
        const request = new Request("https://example.com/webhooks/slack", {
            body: "{}",
            headers: { "content-type": "application/json", "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)), "x-slack-signature": "v0=deadbeef" },
            method: "POST",
        });

        const response = await channel.handle(request);

        expect(response.status).toBe(401);
    });
});

describe(createDiscordInbound, () => {
    const generateKey = async (): Promise<CryptoKeyPair> =>
        await globalThis.crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);

    const signedRequest = async (keyPair: CryptoKeyPair, body: string): Promise<Request> => {
        const timestamp = "1700000000";
        const signature = await globalThis.crypto.subtle.sign({ name: "Ed25519" }, keyPair.privateKey, encoder.encode(`${timestamp}${body}`));

        return new Request("https://example.com/webhooks/discord", {
            body,
            headers: { "content-type": "application/json", "x-signature-ed25519": toHex(signature), "x-signature-timestamp": timestamp },
            method: "POST",
        });
    };

    const publicKeyHex = async (keyPair: CryptoKeyPair): Promise<string> => toHex(await globalThis.crypto.subtle.exportKey("raw", keyPair.publicKey));

    it("answers the PING handshake with a PONG", async () => {
        expect.assertions(2);

        const keyPair = await generateKey();
        const channel = createDiscordInbound({ onMessage: () => undefined, publicKey: await publicKeyHex(keyPair) });
        const response = await channel.handle(await signedRequest(keyPair, JSON.stringify({ type: 1 })));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toStrictEqual({ type: 1 });
    });

    it("parses an application command and replies with a channel message", async () => {
        expect.assertions(3);

        const keyPair = await generateKey();
        let received: InboundMessage | undefined;
        const channel = createDiscordInbound({
            onMessage: (message) => {
                received = message;

                return { text: "hi" };
            },
            publicKey: await publicKeyHex(keyPair),
        });
        const body = JSON.stringify({ channel_id: "C1", data: { name: "ask" }, id: "I1", member: { user: { id: "U1", username: "ada" } }, type: 2 });
        const response = await channel.handle(await signedRequest(keyPair, body));

        expect(received?.command?.name).toBe("ask");
        expect(received?.from.username).toBe("ada");
        await expect(response.json()).resolves.toStrictEqual({ data: { content: "hi" }, type: 4 });
    });

    it("rejects an invalid signature with 401", async () => {
        expect.assertions(1);

        const keyPair = await generateKey();
        const otherKey = await generateKey();
        const channel = createDiscordInbound({ onMessage: () => undefined, publicKey: await publicKeyHex(otherKey) });
        const response = await channel.handle(await signedRequest(keyPair, JSON.stringify({ type: 1 })));

        expect(response.status).toBe(401);
    });
});

describe(createTelegramInbound, () => {
    const secretToken = "telegram-secret";

    const request = (body: unknown, token?: string): Request =>
        new Request("https://example.com/webhooks/telegram", {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json", ...token === undefined ? {} : { "x-telegram-bot-api-secret-token": token } },
            method: "POST",
        });

    it("verifies the secret token and serialises a sendMessage reply", async () => {
        expect.assertions(3);

        let received: InboundMessage | undefined;
        const channel = createTelegramInbound({
            onMessage: (message) => {
                received = message;

                return { text: "pong" };
            },
            secretToken,
        });
        const response = await channel.handle(
            request({ message: { chat: { id: 42, type: "private" }, date: 1_700_000_000, from: { first_name: "Ada", id: 7 }, message_id: 5, text: "ping" }, update_id: 1 }, secretToken),
        );

        expect(received?.text).toBe("ping");
        expect(received?.conversationId).toBe("42");
        await expect(response.json()).resolves.toMatchObject({ chat_id: "42", method: "sendMessage", text: "pong" });
    });

    it("rejects a mismatched secret token with 401", async () => {
        expect.assertions(1);

        const channel = createTelegramInbound({ onMessage: () => undefined, secretToken });
        const response = await channel.handle(request({ update_id: 1 }, "wrong"));

        expect(response.status).toBe(401);
    });

    it("detects bot commands", async () => {
        expect.assertions(2);

        let received: InboundMessage | undefined;
        const channel = createTelegramInbound({
            onMessage: (message) => {
                received = message;
            },
            secretToken,
        });

        await channel.handle(request({ message: { chat: { id: 1 }, from: { id: 1 }, message_id: 1, text: "/start now" }, update_id: 2 }, secretToken));

        expect(received?.type).toBe("command");
        expect(received?.command).toStrictEqual({ args: "now", name: "start" });
    });
});

describe(createTwilioInbound, () => {
    const authToken = "twilio-auth-token";
    const url = "https://example.com/webhooks/twilio";

    const signedRequest = async (parameters: Record<string, string>): Promise<Request> => {
        const body = new URLSearchParams(parameters).toString();
        const keys = Object.keys(parameters).toSorted((a, b) => a.localeCompare(b));
        let base = url;

        for (const key of keys) {
            base += `${key}${parameters[key] ?? ""}`;
        }

        const signature = toBase64(await hmac(authToken, base, "SHA-1"));

        return new Request(url, { body, headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": signature }, method: "POST" });
    };

    it("parses an inbound SMS and replies with TwiML", async () => {
        expect.assertions(4);

        let received: InboundMessage | undefined;
        const channel = createTwilioInbound({
            authToken,
            onMessage: (message) => {
                received = message;

                return { text: "got it" };
            },
        });
        const response = await channel.handle(await signedRequest({ Body: "hello", From: "+15555550100", MessageSid: "SM1", To: "+15555550111" }));

        expect(received?.text).toBe("hello");
        expect(received?.from.id).toBe("+15555550100");
        expect(response.headers.get("content-type")).toContain("text/xml");
        await expect(response.text()).resolves.toContain("<Message>got it</Message>");
    });

    it("flags WhatsApp transport and strips the prefix", async () => {
        expect.assertions(2);

        let received: InboundMessage | undefined;
        const channel = createTwilioInbound({
            authToken,
            onMessage: (message) => {
                received = message;
            },
        });

        await channel.handle(await signedRequest({ Body: "hi", From: "whatsapp:+15555550100", MessageSid: "SM2", To: "whatsapp:+15555550111" }));

        expect(received?.from.id).toBe("+15555550100");
        expect(received?.metadata?.transport).toBe("whatsapp");
    });

    it("replies to the sender through the provider, re-applying the WhatsApp prefix", async () => {
        expect.assertions(1);

        const provider = mockProvider({ channel: "sms", id: "twilio" });
        const channel = createTwilioInbound({
            authToken,
            onMessage: async (_message, context) => {
                await context.reply("got it");
            },
            provider,
        });

        await channel.handle(await signedRequest({ Body: "hi", From: "whatsapp:+15555550100", MessageSid: "SM3", To: "whatsapp:+15555550111" }));

        expect(provider.getInstance?.().last()?.payload).toMatchObject({ from: "whatsapp:+15555550111", text: "got it", to: "whatsapp:+15555550100" });
    });

    it("rejects context.reply when no provider is configured", async () => {
        expect.assertions(1);

        const channel = createTwilioInbound({
            authToken,
            onMessage: async (_message, context) => {
                await context.reply("nope");
            },
        });

        const request = await signedRequest({ Body: "hi", From: "+15555550100", MessageSid: "SM4", To: "+15555550111" });

        await expect(channel.handle(request)).rejects.toThrow("No `provider` configured to send replies");
    });
});

describe(createInboundRouter, () => {
    it("dispatches by path and 404s unknown paths", async () => {
        expect.assertions(2);

        const channel = createTelegramInbound({ onMessage: () => undefined });
        const router = createInboundRouter({ "/webhooks/telegram": channel });

        const ok = await router(new Request("https://example.com/webhooks/telegram", { body: JSON.stringify({ update_id: 1 }), method: "POST" }));
        const missing = await router(new Request("https://example.com/nope", { method: "POST" }));

        expect(ok.status).toBe(204);
        expect(missing.status).toBe(404);
    });
});
