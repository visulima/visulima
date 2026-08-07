import fcmProviderFactory from "./provider";

export { default as createFcmProvider } from "./provider";
export type { FcmConfig } from "./types";

/** @deprecated Renamed to `createFcmProvider`; removed in the next major. */
export const fcmProvider: typeof fcmProviderFactory = fcmProviderFactory;
