import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discordProvider } from "../src/providers/chat/discord";
import { msTeamsProvider } from "../src/providers/chat/msteams";
import { slackProvider } from "../src/providers/chat/slack";
import { telegramProvider } from "../src/providers/chat/telegram";
import { expoProvider } from "../src/providers/push/expo";
import { fcmProvider } from "../src/providers/push/fcm";

const jsonResponse = (body: unknown, status = 200): Response => Response.json(body, { headers: { "Content-Type": "application/json" }, status });

const textResponse = (text: string, status = 200): Response => new Response(text, { status });

describe("chat + push providers", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("slack web API returns the message ts", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ ok: true, ts: "1700000000.0001" }));

        const provider = slackProvider({ defaultChannel: "C1", token: "xoxb-1" });
        const result = await provider.send({ text: "hi" });

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe("1700000000.0001");
    });

    it("slack webhook mode treats 'ok' body as success", async () => {
        expect.assertions(1);

        fetchMock.mockResolvedValue(textResponse("ok"));

        const provider = slackProvider({ webhookUrl: "https://hooks.slack.com/services/x" });
        const result = await provider.send({ text: "hi" });

        expect(result.success).toBe(true);
    });

    it("discord requests ?wait=true and returns the message id", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ id: "d1" }));

        const provider = discordProvider({ webhookUrl: "https://discord.com/api/webhooks/1/abc" });
        const result = await provider.send({ text: "hi" });

        expect(result.data?.messageId).toBe("d1");
        expect(String(fetchMock.mock.calls[0][0])).toContain("wait=true");
    });

    it("msteams posts a MessageCard and succeeds on 200", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(textResponse("1"));

        const provider = msTeamsProvider({ webhookUrl: "https://outlook.office.com/webhook/x" });
        const result = await provider.send({ text: "hi" });

        expect(result.success).toBe(true);

        const [, init] = fetchMock.mock.calls[0];

        expect(String(init.body)).toContain("MessageCard");
    });

    it("telegram returns the message id and requires a chat id", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 42 } }));

        const provider = telegramProvider({ botToken: "1:abc", defaultChatId: 99 });
        const result = await provider.send({ text: "hi" });

        expect(result.data?.messageId).toBe("42");

        const noChat = telegramProvider({ botToken: "1:abc" });
        const failed = await noChat.send({ text: "hi" });

        expect(failed.success).toBe(false);
    });

    it("expo sends a batch and maps per-token tickets", async () => {
        expect.assertions(2);

        fetchMock.mockResolvedValue(
            jsonResponse({
                data: [
                    { id: "t1", status: "ok" },
                    { details: { error: "DeviceNotRegistered" }, status: "error" },
                ],
            }),
        );

        const provider = expoProvider({});
        const result = await provider.send({ body: "hi", title: "T", to: ["ExpoTok1", "ExpoTok2"] });

        expect(result.success).toBe(true);
        expect(result.data?.recipients).toHaveLength(2);
    });

    it("fcm uses getAccessToken and posts to the v1 endpoint", async () => {
        expect.assertions(3);

        fetchMock.mockResolvedValue(jsonResponse({ name: "projects/p/messages/0:1" }));

        const getAccessToken = vi.fn().mockResolvedValue("ya29.token");
        const provider = fcmProvider({ getAccessToken, projectId: "p" });
        const result = await provider.send({ body: "hi", title: "T", to: "devtoken" });

        expect(result.success).toBe(true);
        expect(getAccessToken).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/projects/p/messages:send");
    });
});
