import NotificationError from "../../errors/notification-error";
import type { Provider } from "../../providers/provider";
import type { EmailChannelPayload, NotificationResult, Result } from "../../types";

/**
 * The result shape returned by `@visulima/email`'s `Mail.send`.
 */
interface EmailSendResult {
    data?: { messageId: string; provider?: string; response?: unknown; sent?: boolean; timestamp?: Date };
    error?: unknown;
    success: boolean;
}

/**
 * Structural type for a `@visulima/email` `Mail` instance. Kept structural so the email
 * peer stays optional — pass a configured `createMail(...)` result.
 */
export interface EmailLike {
    send: (message: unknown) => Promise<EmailSendResult>;
}

export interface EmailChannelConfig {
    /** Provider id reported on results (default `"email"`). */
    id?: string;
}

/**
 * Adapts a configured `@visulima/email` `Mail` instance into a notification channel
 * provider, so email can participate in multi-channel sends and routing.
 * @param mail A `Mail` instance from `createMail(...)`.
 * @param config Optional config.
 * @returns An email-channel provider.
 * @example
 * ```ts
 * import { createMail } from "@visulima/email";
 * import { resendProvider } from "@visulima/email/providers/resend";
 * import { createNotification } from "@visulima/notification";
 * import { emailChannel } from "@visulima/notification/channels/email";
 *
 * const mail = createMail(resendProvider({ apiKey }));
 * const notify = createNotification({ email: emailChannel(mail) });
 * ```
 */
export const emailChannel = (mail: EmailLike, config: EmailChannelConfig = {}): Provider<unknown, EmailChannelPayload> => {
    const id = config.id ?? "email";

    return {
        channel: "email",
        features: { attachments: true, batchSending: true, richContent: true, templates: true, tracking: true },
        id,
        initialize: () => {},
        isAvailable: () => true,
        send: async (payload: EmailChannelPayload): Promise<Result<NotificationResult>> => {
            const result = await mail.send(payload);

            if (!result.success || !result.data) {
                return {
                    error: new NotificationError(id, result.error instanceof Error ? result.error.message : "Email send failed", { cause: result.error }),
                    success: false,
                };
            }

            return {
                data: {
                    channel: "email",
                    messageId: result.data.messageId,
                    provider: result.data.provider ?? id,
                    response: result.data.response,
                    sent: result.data.sent ?? true,
                    timestamp: result.data.timestamp ?? new Date(),
                },
                success: true,
            };
        },
    };
};
