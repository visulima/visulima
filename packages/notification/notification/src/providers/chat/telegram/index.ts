import telegramProviderFactory from "./provider";

export type { TelegramReceiverOptions } from "../../../inbound/channels/telegram";
export { createTelegramReceiver } from "../../../inbound/channels/telegram";
export { default as createTelegramProvider } from "./provider";
export type { TelegramConfig } from "./types";

/** @deprecated Renamed to `createTelegramProvider`; removed in the next major. */
export const telegramProvider: typeof telegramProviderFactory = telegramProviderFactory;
