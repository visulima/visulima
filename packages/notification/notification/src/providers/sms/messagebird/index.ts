import messageBirdProviderFactory from "./provider";

export type { MessageBirdReceiverOptions } from "../../../inbound/channels/messagebird";
export { createMessageBirdReceiver } from "../../../inbound/channels/messagebird";
export { default as createMessageBirdProvider } from "./provider";
export type { MessageBirdConfig } from "./types";

/** @deprecated Renamed to `createMessageBirdProvider`; removed in the next major. */
export const messageBirdProvider: typeof messageBirdProviderFactory = messageBirdProviderFactory;
