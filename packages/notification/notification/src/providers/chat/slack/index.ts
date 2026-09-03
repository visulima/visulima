import slackProviderFactory from "./provider";

export type { SlackReceiverOptions } from "../../../inbound/channels/slack";
export { createSlackReceiver } from "../../../inbound/channels/slack";
export { default as createSlackProvider } from "./provider";
export type { SlackConfig } from "./types";

/** @deprecated Renamed to `createSlackProvider`; removed in the next major. */
export const slackProvider: typeof slackProviderFactory = slackProviderFactory;
