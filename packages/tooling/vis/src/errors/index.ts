/**
 * Typed errors raised by the vis config loader chain. Consumers switch
 * on `instanceof VisConfigError` to distinguish loader failures from
 * arbitrary user-code exceptions thrown inside a config file.
 */

export { VisConfigCycleError } from "./vis-config-cycle-error";
export type { DeprecatedKey } from "./vis-config-deprecated-key-error";
export { VisConfigDeprecatedKeyError } from "./vis-config-deprecated-key-error";
// fallow-ignore-next-line unused-export -- base error class published on the errors barrel for `instanceof VisConfigError` checks
export { VisConfigError } from "./vis-config-error";
export { VisConfigLoadError } from "./vis-config-load-error";
export { VisConfigNotFoundError } from "./vis-config-not-found-error";
