import telnyxProviderFactory from "./provider";

export type { TelnyxReceiverOptions } from "../../../inbound/channels/telnyx";
export { createTelnyxReceiver } from "../../../inbound/channels/telnyx";
export { default as createTelnyxProvider } from "./provider";
export type { TelnyxConfig } from "./types";

/** @deprecated Renamed to `createTelnyxProvider`; removed in the next major. */
export const telnyxProvider: typeof telnyxProviderFactory = telnyxProviderFactory;
