import NotificationError from "../../../errors/notification-error";
import type { NotificationResult, PushPayload, RecipientResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import generateMessageId from "../../utils/id";
import type { ExpoConfig } from "./types";

const DEFAULT_ENDPOINT = "https://exp.host";

interface ExpoTicket {
    details?: { error?: string };
    id?: string;
    message?: string;
    status?: "error" | "ok";
}

interface ExpoResponse {
    data?: ExpoTicket | ExpoTicket[];
}

/**
 * Expo push provider. Sends a batch of device tokens in one call. Edge-safe — `fetch` only.
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */
const expoProvider: ProviderFactory<ExpoConfig, PushPayload> = defineProvider<ExpoConfig, PushPayload>((config?: ExpoConfig) => {
    const options = config ?? {};
    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const retries = options.retries ?? 3;
    const timeout = options.timeout ?? 30_000;
    const url = `${endpoint}/--/api/v2/push/send`;

    return {
        channel: "push",
        endpoint,
        features: { batchSending: true, media: true, richContent: true },
        id: "expo",
        initialize: () => {},
        isAvailable: () => true,
        options,
        send: async (payload: PushPayload): Promise<Result<NotificationResult>> => {
            const recipients = toRecipientList(payload.to);

            const messages = recipients.map((to) => {
                return {
                    badge: payload.badge,
                    body: payload.body,
                    data: payload.data,
                    sound: payload.sound ?? "default",
                    title: payload.title,
                    to,
                };
            });

            const headers: Record<string, string> = { "Content-Type": "application/json" };

            if (options.accessToken) {
                headers.Authorization = `Bearer ${options.accessToken}`;
            }

            const result = await requestWithRetry<ExpoResponse>(url, { body: JSON.stringify(messages), headers, method: "POST", timeout }, retries);

            if (!result.success || !result.data) {
                return { error: new NotificationError("expo", result.error instanceof Error ? result.error.message : "Request failed"), success: false };
            }

            if (result.data.status >= 400) {
                return { error: new NotificationError("expo", `HTTP ${String(result.data.status)}`), success: false };
            }

            const tickets = result.data.body.data;

            let ticketList: ExpoTicket[];

            if (Array.isArray(tickets)) {
                ticketList = tickets;
            } else {
                ticketList = tickets ? [tickets] : [];
            }

            const recipientResults: RecipientResult[] = recipients.map((to, index) => {
                const ticket = ticketList[index];

                if (ticket?.status === "error") {
                    return { error: ticket.details?.error ?? ticket.message ?? "error", id: to, status: "failed" };
                }

                return { id: to, messageId: ticket?.id, status: "sent" };
            });

            const sent = recipientResults.filter((r) => r.status === "sent");

            if (sent.length === 0) {
                return { error: new NotificationError("expo", recipientResults[0]?.error ?? "All tokens failed"), success: false };
            }

            return {
                data: {
                    channel: "push",
                    messageId: sent[0]?.messageId ?? generateMessageId("expo"),
                    provider: "expo",
                    recipients: recipientResults,
                    sent: true,
                    timestamp: new Date(),
                },
                success: true,
            };
        },
    };
});

export default expoProvider;
