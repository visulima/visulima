import type { Except, TsConfigJson } from "type-fest";

export type TsConfigJsonResolved = Except<TsConfigJson, "extends">;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cache<T = any> = Map<string, T>;
