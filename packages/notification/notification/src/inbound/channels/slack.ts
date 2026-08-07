import type { Provider } from "../../providers/provider";
import type { ChatPayload } from "../../types";
import { slackWebhook } from "../../webhooks/slack";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { chatReply } from "../reply";
import type { InboundChannel, InboundChannelOptions, InboundMessage } from "../types";
import { asRawResponse, asReply, asString, headersToRecord, jsonResponse, noContent, rejectionResponse } from "../utils";

const SIGNATURE_HEADER = "X-Slack-Signature";
const LEADING_SLASH = /^\//u;

/**
 * Reads a value from a `URLSearchParams` as a string, or `undefined` when absent/empty.
 * @param parameters The parsed form parameters.
 * @param key The parameter name.
 * @returns The value, or `undefined`.
 */
const formValue = (parameters: URLSearchParams, key: string): string | undefined => parameters.get(key) ?? undefined;

/**
 * Maps a verified Slack payload to a normalised {@link InboundMessage}, or `undefined` when
 * the payload is not a message/command/interaction the receiver dispatches.
 * @param body The raw request body.
 * @param contentType The request content type.
 * @returns The normalised message, or `undefined`.
 */
const parseSlack = (body: string, contentType: string): InboundMessage | undefined => {
    // Slash commands and interactions arrive form-encoded; Events API arrives as JSON.
    if (contentType.includes("application/x-www-form-urlencoded")) {
        const parameters = new URLSearchParams(body);
        const rawPayload = formValue(parameters, "payload");

        if (rawPayload !== undefined) {
            const payload = tryParseObject(rawPayload);

            if (payload === undefined) {
                return undefined;
            }

            const user = payload.user as Record<string, unknown> | undefined;
            const container = payload.container as Record<string, unknown> | undefined;
            const channel = payload.channel as Record<string, unknown> | undefined;

            return {
                channel: "chat",
                conversationId: asString(channel?.id),
                from: { id: asString(user?.id) ?? "", name: asString(user?.name) },
                id: asString(payload.trigger_id) ?? "",
                metadata: { apiAppId: payload.api_app_id, teamId: (payload.team as Record<string, unknown> | undefined)?.id },
                provider: "slack",
                raw: payload,
                threadId: asString(container?.message_ts),
                timestamp: new Date(),
                type: "callback",
            };
        }

        const command = formValue(parameters, "command");

        if (command !== undefined) {
            return {
                channel: "chat",
                command: { args: formValue(parameters, "text"), name: command.replace(LEADING_SLASH, "") },
                conversationId: formValue(parameters, "channel_id"),
                from: { id: formValue(parameters, "user_id") ?? "", username: formValue(parameters, "user_name") },
                id: formValue(parameters, "trigger_id") ?? "",
                metadata: { apiAppId: formValue(parameters, "api_app_id"), teamId: formValue(parameters, "team_id") },
                provider: "slack",
                raw: Object.fromEntries(parameters),
                text: formValue(parameters, "text"),
                timestamp: new Date(),
                type: "command",
            };
        }

        return undefined;
    }

    const parsed = tryParseObject(body);

    if (parsed?.type !== "event_callback") {
        return undefined;
    }

    const event = parsed.event as Record<string, unknown> | undefined;

    if (event === undefined) {
        return undefined;
    }

    const eventType = asString(event.type) ?? "";
    const isMessage = eventType === "message" || eventType === "app_mention";
    const ts = asString(event.ts);
    const timestampSeconds = ts === undefined ? Number.NaN : Number.parseFloat(ts);

    return {
        channel: "chat",
        conversationId: asString(event.channel),
        from: { id: asString(event.user) ?? "", isBot: typeof event.bot_id === "string" },
        id: asString(parsed.event_id) ?? ts ?? "",
        metadata: { apiAppId: parsed.api_app_id, eventType, teamId: parsed.team_id },
        provider: "slack",
        raw: parsed,
        text: asString(event.text),
        threadId: asString(event.thread_ts) ?? ts,
        timestamp: Number.isNaN(timestampSeconds) ? new Date() : new Date(timestampSeconds * 1000),
        type: isMessage ? "message" : "event",
    };
};

/**
 * Options for the Slack inbound receiver.
 */
export interface SlackInboundOptions extends InboundChannelOptions {
    /**
     * The outbound Slack chat provider used by `context.reply()` (and for replying to Events
     * API deliveries, which cannot answer in the HTTP response). Optional.
     */
    provider?: Provider<unknown, ChatPayload>;
    /** The Slack app signing secret, used to verify `X-Slack-Signature`. */
    signingSecret: string;
}

/**
 * Creates a Slack inbound receiver covering the Events API, slash commands and interactive
 * components. Requests are verified with Slack's v0 signing scheme (5-minute replay window)
 * before dispatch, and the `url_verification` handshake is answered automatically.
 *
 * Slash-command and interaction handlers may return an {@link ../types.InboundReply} to post
 * a synchronous message in the HTTP response; Events API deliveries are acknowledged with
 * `200` and should be replied to through the outbound Slack provider.
 * @param options The receiver options.
 * @returns The inbound channel.
 */
export const createSlackInbound = (options: SlackInboundOptions): InboundChannel => {
    return {
        channel: "chat",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);

            const verified = await slackWebhook.verify(body, headers, options.signingSecret);

            if (!verified) {
                const reason = getHeader(headers, SIGNATURE_HEADER) === undefined ? "missing_signature" : "invalid_signature";

                return rejectionResponse(reason, request, options.onError);
            }

            const contentType = getHeader(headers, "content-type") ?? "";

            // Answer the one-time URL verification handshake without invoking the handler.
            if (contentType.includes("application/json")) {
                const parsed = tryParseObject(body);

                if (parsed?.type === "url_verification") {
                    return jsonResponse({ challenge: parsed.challenge });
                }
            }

            const message = parseSlack(body, contentType);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: chatReply("slack", message, options.provider), request });
            const raw = asRawResponse(result);

            if (raw !== undefined) {
                return raw;
            }

            const reply = asReply(result);

            // Only slash commands / interactions can carry a synchronous reply in the response body.
            if (reply !== undefined && (message.type === "command" || message.type === "callback")) {
                return jsonResponse({ blocks: reply.blocks, text: reply.text, ...reply.raw });
            }

            return new Response(undefined, { status: 200 });
        },
        provider: "slack",
    };
};
