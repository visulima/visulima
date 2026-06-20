import type { BaseNotificationPayload, ChannelType, FeatureFlags, MaybePromise, NotificationEvent, NotificationResult, Result } from "../types";

/**
 * Standard provider interface for notification channels. Every provider belongs to
 * exactly one {@link ChannelType} and accepts a channel-specific payload.
 */
export interface Provider<OptionsT = unknown, PayloadT extends BaseNotificationPayload = BaseNotificationPayload, InstanceT = unknown> {
    /** The channel this provider delivers on. */
    readonly channel: ChannelType;
    endpoint?: string;
    features?: FeatureFlags;
    getInstance?: () => InstanceT;
    /** Unique provider id, e.g. `"twilio"`, `"slack"`, `"fcm"`. */
    readonly id: string;
    initialize: () => MaybePromise<void>;
    isAvailable: () => MaybePromise<boolean>;
    options?: OptionsT;
    /** Map a provider webhook body to a normalised lifecycle event. */
    parseEventBody?: (body: unknown, headers?: Record<string, string>) => MaybePromise<NotificationEvent | undefined>;
    send: (payload: PayloadT) => MaybePromise<Result<NotificationResult>>;
    shutdown?: () => MaybePromise<void>;
    validateCredentials?: () => MaybePromise<boolean>;
}

/**
 * Type for a provider factory function.
 */
export type ProviderFactory<OptionsT = unknown, PayloadT extends BaseNotificationPayload = BaseNotificationPayload, InstanceT = unknown> = (
    options?: OptionsT,
) => Provider<OptionsT, PayloadT, InstanceT>;

/**
 * Helper to define a notification provider (identity function for type inference).
 * @param factory The provider factory function.
 * @returns The same factory function.
 */
export const defineProvider = <OptionsT = unknown, PayloadT extends BaseNotificationPayload = BaseNotificationPayload, InstanceT = unknown>(
    factory: ProviderFactory<OptionsT, PayloadT, InstanceT>,
): ProviderFactory<OptionsT, PayloadT, InstanceT> => factory;
