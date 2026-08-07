import { mockProvider as mockProviderImpl } from "./provider";

export type { MockProviderConfig, MockProviderInstance, MockSentMessage } from "./provider";
export { mockProvider as createMockProvider } from "./provider";

/** @deprecated Renamed to `createMockProvider`; removed in the next major. */
export const mockProvider: typeof mockProviderImpl = mockProviderImpl;
