import { failoverProvider as failoverProviderImpl } from "./provider";

export type { FailoverConfig } from "./provider";
export { failoverProvider as createFailoverProvider } from "./provider";

/** @deprecated Renamed to `createFailoverProvider`; removed in the next major. */
export const failoverProvider: typeof failoverProviderImpl = failoverProviderImpl;
