import discordProviderFactory from "./provider";

export type { DiscordReceiverOptions } from "../../../inbound/channels/discord";
export { createDiscordReceiver } from "../../../inbound/channels/discord";
export { default as createDiscordProvider } from "./provider";
export type { DiscordConfig } from "./types";

/** @deprecated Renamed to `createDiscordProvider`; removed in the next major. */
export const discordProvider: typeof discordProviderFactory = discordProviderFactory;
