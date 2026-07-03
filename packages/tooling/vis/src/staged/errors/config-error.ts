import { StagedError } from "./staged-error";

/** Configuration was missing, malformed, or resolved to an unsupported shape. */
export class ConfigError extends StagedError {}
