import expoProviderFactory from "./provider";

export { default as createExpoProvider } from "./provider";
export type { ExpoConfig } from "./types";

/** @deprecated Renamed to `createExpoProvider`; removed in the next major. */
export const expoProvider: typeof expoProviderFactory = expoProviderFactory;
