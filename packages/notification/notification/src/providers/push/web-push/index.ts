import webPushProviderFactory from "./provider";

export { default as createWebPushProvider } from "./provider";
export type { PushSubscriptionLike, WebPushConfig } from "./types";

/** @deprecated Renamed to `createWebPushProvider`; removed in the next major. */
export const webPushProvider: typeof webPushProviderFactory = webPushProviderFactory;
