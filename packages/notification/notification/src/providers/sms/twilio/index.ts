import twilioProviderFactory from "./provider";

export type { TwilioReceiverOptions } from "../../../inbound/channels/twilio";
export { createTwilioReceiver } from "../../../inbound/channels/twilio";
export { default as createTwilioProvider } from "./provider";
export type { TwilioConfig } from "./types";

/** @deprecated Renamed to `createTwilioProvider`; removed in the next major. */
export const twilioProvider: typeof twilioProviderFactory = twilioProviderFactory;
