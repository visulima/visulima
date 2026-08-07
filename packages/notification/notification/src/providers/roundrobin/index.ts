import { roundRobinProvider as roundRobinProviderImpl } from "./provider";

export type { RoundRobinConfig } from "./provider";
export { roundRobinProvider as createRoundRobinProvider } from "./provider";

/** @deprecated Renamed to `createRoundRobinProvider`; removed in the next major. */
export const roundRobinProvider: typeof roundRobinProviderImpl = roundRobinProviderImpl;
