import msTeamsProviderFactory from "./provider";

export type { MsTeamsReceiverOptions } from "../../../inbound/channels/msteams";
export { createMsTeamsReceiver } from "../../../inbound/channels/msteams";
export { default as createMsTeamsProvider } from "./provider";
export type { MsTeamsConfig } from "./types";

/** @deprecated Renamed to `createMsTeamsProvider`; removed in the next major. */
export const msTeamsProvider: typeof msTeamsProviderFactory = msTeamsProviderFactory;
