import NotificationError from "../../errors/notification-error";
import type { BaseNotificationPayload, ChannelType, NotificationResult, Result } from "../../types";
import type { ProviderFactory } from "../provider";
import { defineProvider } from "../provider";

let counter = 0;

export interface MockSentMessage {
    messageId: string;
    payload: BaseNotificationPayload;
    timestamp: Date;
}

export interface MockProviderConfig {
    /** Channel to advertise (defaults to `"sms"`). */
    channel?: ChannelType;
    /** When set, every `send` fails with this message. */
    failWith?: string;
    /** Provider id (defaults to `"mock"`). */
    id?: string;
}

export interface MockProviderInstance {
    /** Clears the recorded message log. */
    clear: () => void;
    /** Returns the most recently sent message, if any. */
    last: () => MockSentMessage | undefined;
    /** All messages recorded by this provider. */
    readonly sent: MockSentMessage[];
}

/**
 * In-memory provider for tests and local development. Records every payload it is
 * asked to send and can be configured to fail deterministically.
 */
export const mockProvider: ProviderFactory<MockProviderConfig, BaseNotificationPayload, MockProviderInstance> = defineProvider<
    MockProviderConfig,
    BaseNotificationPayload,
    MockProviderInstance
>((config: MockProviderConfig = {}) => {
    const sent: MockSentMessage[] = [];
    const channel = config.channel ?? "sms";
    const id = config.id ?? "mock";

    const instance: MockProviderInstance = {
        clear: () => {
            sent.length = 0;
        },
        last: () => sent.at(-1),
        sent,
    };

    return {
        channel,
        getInstance: () => instance,
        id,
        initialize: () => {},
        isAvailable: () => true,
        send: (payload: BaseNotificationPayload): Result<NotificationResult> => {
            if (config.failWith !== undefined) {
                return { error: new NotificationError(id, config.failWith), success: false };
            }

            counter += 1;

            const timestamp = new Date();
            const messageId = `mock-${String(counter)}`;

            sent.push({ messageId, payload, timestamp });

            return {
                data: {
                    channel,
                    messageId,
                    provider: id,
                    sent: true,
                    timestamp,
                },
                success: true,
            };
        },
        validateCredentials: () => true,
    };
});
