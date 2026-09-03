import snsProviderFactory from "./provider";

export { default as createSnsProvider } from "./provider";
export type { SnsConfig } from "./types";

/** @deprecated Renamed to `createSnsProvider`; removed in the next major. */
export const snsProvider: typeof snsProviderFactory = snsProviderFactory;
