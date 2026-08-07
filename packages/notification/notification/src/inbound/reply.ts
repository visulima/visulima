import NotificationError from "../errors/notification-error";
import type { Provider } from "../providers/provider";
import type { ChatPayload, NotificationResult, Result, SmsPayload } from "../types";
import type { InboundMessage, InboundReply, InboundReplyFunction, InboundReplyInput } from "./types";

/**
 * Normalises the shorthand string form of a reply into an {@link InboundReply}.
 * @param input The reply content, as an object or a plain string.
 * @returns The reply as an object, wrapping a bare string as `{ text }`.
 */
export const normaliseReply = (input: InboundReplyInput): InboundReply => {
    if (typeof input === "string") {
        return { text: input };
    }

    return input;
};

/**
 * Creates the reply sender for a chat channel (Slack, Discord, Telegram), mapping the inbound
 * message and reply into a {@link ChatPayload} sent through `outbound`. The reply targets the
 * originating conversation and thread. The returned function rejects when `outbound` is absent.
 * @param provider The provider id, used in the not-configured error.
 * @param message The inbound message being replied to.
 * @param outbound The matching outbound chat provider, or `undefined`.
 * @returns A reply sender bound to `message`.
 */
export const chatReply = (provider: string, message: InboundMessage, outbound: Provider<unknown, ChatPayload> | undefined): InboundReplyFunction =>
    async (input: InboundReplyInput): Promise<Result<NotificationResult>> => {
        if (outbound === undefined) {
            throw new NotificationError(`${provider}-inbound`, "No `provider` configured to send replies", {
                hint: `Pass \`provider\` to the ${provider} inbound receiver to enable context.reply()`,
            });
        }

        const reply = normaliseReply(input);

        return outbound.send({ blocks: reply.blocks, text: reply.text ?? "", threadId: reply.threadId ?? message.threadId, to: message.conversationId });
    };

/**
 * Creates the reply sender for the Twilio channel, mapping the inbound message and reply into
 * an {@link SmsPayload} sent through `outbound`. The reply is addressed back to the sender from
 * the receiving number, re-applying the `whatsapp:` prefix for WhatsApp. The returned function
 * rejects when `outbound` is absent.
 * @param message The inbound message being replied to.
 * @param outbound The matching outbound SMS provider, or `undefined`.
 * @returns A reply sender bound to `message`.
 */
export const smsReply = (message: InboundMessage, outbound: Provider<unknown, SmsPayload> | undefined): InboundReplyFunction =>
    async (input: InboundReplyInput): Promise<Result<NotificationResult>> => {
        if (outbound === undefined) {
            throw new NotificationError("twilio-inbound", "No `provider` configured to send replies", {
                hint: "Pass `provider` to the twilio inbound receiver to enable context.reply()",
            });
        }

        const reply = normaliseReply(input);
        const prefix = message.metadata?.transport === "whatsapp" ? "whatsapp:" : "";

        return outbound.send({
            from: message.conversationId === undefined ? undefined : `${prefix}${message.conversationId}`,
            text: reply.text ?? "",
            to: `${prefix}${message.from.id}`,
        });
    };
