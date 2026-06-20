import type { ChannelGate } from "../routing";
import type { ChannelType } from "../types";

/**
 * A subscriber's channel preferences. A channel set to `false` is opted out; channels
 * absent default to allowed.
 */
export interface SubscriberPreferences {
    channels: Partial<Record<ChannelType, boolean>>;
}

export interface IsAllowedOptions {
    /** Critical notifications bypass opt-outs (e.g. security alerts). */
    critical?: boolean;
}

/**
 * Stores per-subscriber channel preferences and answers allow/deny questions.
 */
export interface PreferenceStore {
    get: (subscriberId: string) => Promise<SubscriberPreferences> | SubscriberPreferences;
    isAllowed: (subscriberId: string, channel: ChannelType, options?: IsAllowedOptions) => Promise<boolean> | boolean;
    set: (subscriberId: string, preferences: SubscriberPreferences) => Promise<void> | void;
}

/**
 * In-memory {@link PreferenceStore}.
 */
export class MemoryPreferenceStore implements PreferenceStore {
    readonly #prefs = new Map<string, SubscriberPreferences>();

    public get(subscriberId: string): SubscriberPreferences {
        return this.#prefs.get(subscriberId) ?? { channels: {} };
    }

    public set(subscriberId: string, preferences: SubscriberPreferences): void {
        this.#prefs.set(subscriberId, preferences);
    }

    public isAllowed(subscriberId: string, channel: ChannelType, options: IsAllowedOptions = {}): boolean {
        if (options.critical) {
            return true;
        }

        return this.get(subscriberId).channels[channel] !== false;
    }
}

/**
 * Builds a {@link ChannelGate} for `route(...)` from a preference store. The subscriber id
 * is resolved from each payload (default: the payload's `to` field, stringified).
 * @param store The preference store.
 * @param options Resolution options.
 * @param options.critical When true the produced gate treats every send as critical, bypassing opt-outs.
 * @param options.subscriberId Resolver mapping a payload to its subscriber id (defaults to the `to` field).
 * @returns A gate suitable for `route(notification, message, { gate })`.
 */
export const preferencesGate = (
    store: PreferenceStore,
    options: { critical?: boolean; subscriberId?: (payload: { to?: unknown }) => string | undefined } = {},
): ChannelGate => {
    const defaultResolve = (payload: { to?: unknown }): string | undefined => {
        const { to } = payload;

        if (to === undefined || to === null) {
            return undefined;
        }

        return typeof to === "string" ? to : JSON.stringify(to);
    };

    const resolve = options.subscriberId ?? defaultResolve;

    return async (channel, payload) => {
        const subscriberId = resolve(payload as { to?: unknown });

        if (!subscriberId) {
            return true;
        }

        return store.isAllowed(subscriberId, channel, { critical: options.critical });
    };
};
