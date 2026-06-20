import type { Provider } from "../../providers/provider";
import type { InAppPayload, NotificationResult, Result } from "../../types";
import type { InAppStore } from "./store";
import { MemoryInAppStore } from "./store";

export interface InAppProviderConfig {
    /** Provider id reported on results (default `"inapp"`). */
    id?: string;
    /** Backing store (default a new {@link MemoryInAppStore}). */
    store?: InAppStore;
}

/**
 * In-app channel provider. Persists notifications to an {@link InAppStore} for a feed/inbox
 * UI to query. Expose the store via `getInstance()` to read/markRead.
 * @param config Provider `id` and the backing {@link InAppStore} (defaults to in-memory).
 * @returns A provider that writes notifications into the configured store.
 */
export const inAppProvider = (config: InAppProviderConfig = {}): Provider<InAppProviderConfig, InAppPayload, InAppStore> => {
    const id = config.id ?? "inapp";
    const store = config.store ?? new MemoryInAppStore();

    return {
        channel: "inapp",
        features: { richContent: true },
        getInstance: () => store,
        id,
        initialize: () => {},
        isAvailable: () => true,
        send: async (payload: InAppPayload): Promise<Result<NotificationResult>> => {
            const stored = await store.add({
                actions: payload.actions,
                body: payload.body,
                data: payload.data,
                subscriberId: payload.to,
                title: payload.title,
            });

            return {
                data: { channel: "inapp", messageId: stored.id, provider: id, sent: true, timestamp: new Date(stored.createdAt) },
                success: true,
            };
        },
    };
};
