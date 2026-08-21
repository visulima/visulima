import { inAppProvider as inAppProviderImpl } from "./provider";

export type { InAppProviderConfig } from "./provider";
export { inAppProvider as createInAppProvider } from "./provider";
export type { InAppStore, ListOptions, StoredNotification } from "./store";
export { MemoryInAppStore } from "./store";
export { createUnstorageInAppStore, UnstorageInAppStore } from "./unstorage-store";

/** @deprecated Renamed to `createInAppProvider`; removed in the next major. */
export const inAppProvider: typeof inAppProviderImpl = inAppProviderImpl;
