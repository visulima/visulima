import NotificationError from "../../../errors/notification-error";
import RequiredOptionError from "../../../errors/required-option-error";
import type { NotificationResult, PushPayload, RecipientResult, Result } from "../../../types";
import type { ProviderFactory } from "../../provider";
import { defineProvider } from "../../provider";
import { toRecipientList } from "../../utils/credentials";
import { requestWithRetry } from "../../utils/http";
import { aggregateRecipientResults } from "../../utils/sms";

interface FcmResponse {
    error?: { message?: string };
    name?: string;
}

/**
 * Firebase Cloud Messaging provider (HTTP v1). Edge-safe — you supply the OAuth2 token
 * (static or via `getAccessToken`), so no `node:crypto`/Google SDK is bundled.
 * @see https://firebase.google.com/docs/cloud-messaging/send-message
 */
const fcmProvider: ProviderFactory<import("./types").FcmConfig, PushPayload> = defineProvider<import("./types").FcmConfig, PushPayload>(
    (config?: import("./types").FcmConfig) => {
        const options = config ?? ({} as import("./types").FcmConfig);

        if (!options.projectId) {
            throw new RequiredOptionError("fcm", "projectId");
        }

        if (!options.accessToken && !options.getAccessToken) {
            throw new RequiredOptionError("fcm", ["accessToken", "getAccessToken"]);
        }

        const endpoint = options.endpoint ?? "https://fcm.googleapis.com";
        const retries = options.retries ?? 3;
        const timeout = options.timeout ?? 30_000;
        const url = `${endpoint}/v1/projects/${options.projectId}/messages:send`;

        // FCM data values must be strings.
        const stringifyData = (data?: Record<string, unknown>): Record<string, string> | undefined => {
            if (!data) {
                return undefined;
            }

            return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
        };

        const sendOne = async (token: string, payload: PushPayload, accessToken: string): Promise<RecipientResult> => {
            const message: Record<string, unknown> = {
                data: stringifyData(payload.data),
                notification: { body: payload.body, image: payload.imageUrl, title: payload.title },
                token,
            };

            const result = await requestWithRetry<FcmResponse>(
                url,
                {
                    body: JSON.stringify({ message }),
                    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    method: "POST",
                    timeout,
                },
                retries,
            );

            if (!result.success || !result.data) {
                return { error: result.error instanceof Error ? result.error.message : "Request failed", id: token, status: "failed" };
            }

            if (result.data.status >= 400) {
                return { error: result.data.body.error?.message ?? `HTTP ${String(result.data.status)}`, id: token, status: "failed" };
            }

            return { id: token, messageId: result.data.body.name, status: "sent" };
        };

        return {
            channel: "push",
            endpoint,
            features: { batchSending: false, media: true, richContent: true },
            id: "fcm",
            initialize: () => {},
            isAvailable: () => Boolean(options.projectId && (options.accessToken ?? options.getAccessToken)),
            options,
            send: async (payload: PushPayload): Promise<Result<NotificationResult>> => {
                let accessToken: string;

                try {
                    accessToken = options.getAccessToken ? await options.getAccessToken() : (options.accessToken as string);
                } catch (error) {
                    return { error: new NotificationError("fcm", "Failed to obtain access token", { cause: error }), success: false };
                }

                const tokens = toRecipientList(payload.to);
                const results: RecipientResult[] = [];

                for (const token of tokens) {
                    // eslint-disable-next-line no-await-in-loop
                    results.push(await sendOne(token, payload, accessToken));
                }

                return aggregateRecipientResults("push", "fcm", results);
            },
        };
    },
);

export default fcmProvider;
