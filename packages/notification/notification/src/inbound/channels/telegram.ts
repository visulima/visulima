import type { Provider } from "../../providers/provider";
import type { ChatPayload } from "../../types";
import { timingSafeEqual } from "../../webhooks/crypto";
import { getHeader, tryParseObject } from "../../webhooks/types";
import { chatReply } from "../reply";
import type { InboundMessage, Receiver, ReceiverOptions } from "../types";
import { asId, asRawResponse, asReply, asString, headersToRecord, jsonResponse, noContent, rejectionResponse } from "../utils";

const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const WHITESPACE = /\s/u;

/** A forum topic id, which Telegram always reports as a positive integer. */
const TOPIC_ID = /^\d+$/u;

/**
 * Parses a Telegram message body into a bot command, or `undefined` when the text is absent
 * or not a `/`-prefixed command. Splits on the first whitespace into `/name[@bot]` and the
 * argument tail, scanning linearly to avoid regex backtracking.
 * @param text The message text.
 * @returns The parsed command, or `undefined`.
 */
const parseCommand = (text: string | undefined): InboundMessage["command"] => {
    if (!text?.startsWith("/")) {
        return undefined;
    }

    const rest = text.slice(1);
    const splitAt = rest.search(WHITESPACE);
    const head = splitAt === -1 ? rest : rest.slice(0, splitAt);
    const name = head.split("@")[0] ?? "";

    if (name.length === 0) {
        return undefined;
    }

    const args = splitAt === -1 ? "" : rest.slice(splitAt + 1).trim();

    return { args: args.length === 0 ? undefined : args, name };
};

/**
 * Maps a Telegram participant record to a normalised {@link InboundMessage.from}.
 * @param user The Telegram `from` record.
 * @returns The normalised participant.
 */
const participant = (user: Record<string, unknown> | undefined): InboundMessage["from"] => {
    return {
        id: asId(user?.id) ?? "",
        isBot: user?.is_bot === true,
        name: asString(user?.first_name),
        username: asString(user?.username),
    };
};

/**
 * Maps a Telegram update to a normalised {@link InboundMessage}, handling both plain messages
 * and callback queries, or `undefined` for updates the receiver does not dispatch.
 * @param update The Telegram update payload.
 * @returns The normalised message, or `undefined`.
 */
const parseTelegram = (update: Record<string, unknown>): InboundMessage | undefined => {
    const updateId = asId(update.update_id) ?? "";
    const callbackQuery = update.callback_query as Record<string, unknown> | undefined;

    if (callbackQuery !== undefined) {
        const message = callbackQuery.message as Record<string, unknown> | undefined;
        const chat = message?.chat as Record<string, unknown> | undefined;

        return {
            channel: "chat",
            conversationId: asId(chat?.id),
            from: participant(callbackQuery.from as Record<string, unknown> | undefined),
            id: asString(callbackQuery.id) ?? updateId,
            provider: "telegram",
            raw: update,
            text: asString(callbackQuery.data),
            timestamp: new Date(),
            type: "callback",
        };
    }

    const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined;

    if (message === undefined) {
        return undefined;
    }

    const chat = message.chat as Record<string, unknown> | undefined;
    const dateSeconds = typeof message.date === "number" ? message.date : Number.NaN;
    const text = asString(message.text);
    const command = parseCommand(text);

    return {
        channel: "chat",
        command,
        conversationId: asId(chat?.id),
        from: participant(message.from as Record<string, unknown> | undefined),
        id: asId(message.message_id) ?? updateId,
        metadata: { chatType: chat?.type },
        provider: "telegram",
        raw: update,
        text,
        threadId: asId(message.message_thread_id),
        timestamp: Number.isNaN(dateSeconds) ? new Date() : new Date(dateSeconds * 1000),
        type: command === undefined ? "message" : "command",
    };
};

/**
 * Options for the Telegram inbound receiver.
 */
export interface TelegramReceiverOptions extends ReceiverOptions {
    /** The outbound Telegram chat provider used by `context.reply()`. Optional. */
    provider?: Provider<unknown, ChatPayload>;

    /**
     * The secret token configured via `setWebhook`'s `secret_token`. When set, the receiver
     * requires a matching `X-Telegram-Bot-Api-Secret-Token` header. Strongly recommended —
     * Telegram updates are otherwise unauthenticated.
     */
    secretToken?: string;
}

/**
 * Creates a Telegram inbound receiver for bot webhook updates. When {@link
 * TelegramReceiverOptions.secretToken} is set, the `X-Telegram-Bot-Api-Secret-Token` header is
 * verified before dispatch.
 *
 * A handler may return an {@link ../types.InboundReply}; it is serialised into a Telegram
 * `sendMessage` method call in the response body (`chat_id` taken from the originating chat),
 * which Telegram executes as the reply. Return `raw` to invoke a different method.
 * @param options Verification config, the message handler and an optional reply provider.
 * @returns The inbound channel.
 */
export const createTelegramReceiver = (options: TelegramReceiverOptions): Receiver => {
    return {
        channel: "chat",
        handle: async (request: Request): Promise<Response> => {
            const body = await request.text();
            const headers = headersToRecord(request.headers);

            if (options.secretToken !== undefined && options.secretToken !== "") {
                const provided = getHeader(headers, SECRET_HEADER);

                if (provided === undefined) {
                    return rejectionResponse("missing_signature", request, options.onError);
                }

                if (!timingSafeEqual(provided, options.secretToken)) {
                    return rejectionResponse("invalid_signature", request, options.onError);
                }
            }

            const update = tryParseObject(body);

            if (update === undefined) {
                return rejectionResponse("invalid_body", request, options.onError);
            }

            const message = parseTelegram(update);

            if (message === undefined) {
                return noContent();
            }

            const result = await options.onMessage(message, { body, headers, reply: chatReply("telegram", message, options.provider), request });
            const raw = asRawResponse(result);

            if (raw !== undefined) {
                return raw;
            }

            const reply = asReply(result);

            if (reply !== undefined && message.conversationId !== undefined) {
                // `threadId` round-trips Telegram's `message_thread_id`, which identifies a forum
                // topic — not a message. Sending it as `reply_parameters.message_id` quotes
                // whichever message happens to carry that id, or fails outright. Non-integer
                // values are not thread ids at all, so they are dropped.
                const threadId = reply.threadId !== undefined && TOPIC_ID.test(reply.threadId) ? Number.parseInt(reply.threadId, 10) : undefined;

                return jsonResponse({
                    chat_id: message.conversationId,
                    message_thread_id: threadId,
                    method: "sendMessage",
                    text: reply.text,
                    ...reply.raw,
                });
            }

            return noContent();
        },
        provider: "telegram",
    };
};
