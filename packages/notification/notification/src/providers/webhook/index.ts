import { webhookProvider as webhookProviderImpl } from "./provider";

export type { WebhookConfig } from "./provider";
export { webhookProvider as createWebhookProvider } from "./provider";

/** @deprecated Renamed to `createWebhookProvider`; removed in the next major. */
export const webhookProvider: typeof webhookProviderImpl = webhookProviderImpl;
