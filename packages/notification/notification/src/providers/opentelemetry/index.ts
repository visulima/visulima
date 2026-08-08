import { otelProvider as otelProviderImpl } from "./provider";

export type { OtelProviderConfig } from "./provider";
export { otelProvider as createOtelProvider } from "./provider";

/** @deprecated Renamed to `createOtelProvider`; removed in the next major. */
export const otelProvider: typeof otelProviderImpl = otelProviderImpl;
