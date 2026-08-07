import vonageProviderFactory from "./provider";

export type { VonageReceiverOptions } from "../../../inbound/channels/vonage";
export { createVonageReceiver } from "../../../inbound/channels/vonage";
export { default as createVonageProvider } from "./provider";
export type { VonageConfig } from "./types";

/** @deprecated Renamed to `createVonageProvider`; removed in the next major. */
export const vonageProvider: typeof vonageProviderFactory = vonageProviderFactory;
