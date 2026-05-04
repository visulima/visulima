export { default as omit } from "./omit";
export { default as pick } from "./pick";
export { default as isPlainObject } from "./utils/is-plain-object";
export type { DeeksOptions as DeepKeysOptions } from "deeks";

// eslint-disable-next-line import/no-extraneous-dependencies
export { deepKeys, deepKeysFromList } from "deeks";
// eslint-disable-next-line import/no-extraneous-dependencies
export { deleteProperty, escapePath, getProperty, hasProperty, setProperty } from "dot-prop";
export type { OmitDeep, Paths, PickDeep, Split } from "type-fest";
