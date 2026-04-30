/**
 * Typed errors raised by the vis config loader chain. Consumers switch
 * on `instanceof VisConfigError` to distinguish loader failures from
 * arbitrary user-code exceptions thrown inside a config file.
 */

export { VisConfigCycleError } from "./vis-config-cycle-error";
export { VisConfigError } from "./vis-config-error";
export { VisConfigLoadError } from "./vis-config-load-error";
export { VisConfigNotFoundError } from "./vis-config-not-found-error";
