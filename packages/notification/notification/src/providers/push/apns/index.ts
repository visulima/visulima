import apnsProviderFactory from "./provider";

export { default as createApnsProvider } from "./provider";
export type { ApnsConfig } from "./types";

/** @deprecated Renamed to `createApnsProvider`; removed in the next major. */
export const apnsProvider: typeof apnsProviderFactory = apnsProviderFactory;
