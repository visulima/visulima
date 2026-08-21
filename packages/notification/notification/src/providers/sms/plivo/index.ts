import plivoProviderFactory from "./provider";

export { default as createPlivoProvider } from "./provider";
export type { PlivoConfig } from "./types";

/** @deprecated Renamed to `createPlivoProvider`; removed in the next major. */
export const plivoProvider: typeof plivoProviderFactory = plivoProviderFactory;
