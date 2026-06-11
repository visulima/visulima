import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels } from "../types";

/**
 * RFC 5424 log levels that should be routed to `stderr` instead of `stdout`.
 *
 * Pail uses the syslog level *names* (`warning`, `error`, `critical`, `alert`,
 * `emergency`, ...) as the value of `meta.type.level` — never the short `"warn"`
 * type alias. Routing therefore has to match the level names, otherwise
 * warning/critical/alert/emergency output silently lands on `stdout`.
 *
 * `trace` is included because the trace type intentionally writes its diagnostic
 * stack to the error stream (parity with `console.trace`).
 * @see https://datatracker.ietf.org/doc/html/rfc5424#page-36
 */
const STDERR_LOG_LEVELS = new Set<string>(["alert", "critical", "emergency", "error", "trace", "warning"]);

/**
 * Determines whether a given log level should be written to `stderr`.
 * @param logLevel The RFC 5424 log level name (e.g. `warning`, `error`).
 * @returns `true` when the level should be routed to `stderr`, `false` for `stdout`.
 */
const isStderrLevel = <L extends string = string>(logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): boolean => STDERR_LOG_LEVELS.has(logLevel);

export default isStderrLevel;
