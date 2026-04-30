import { createPail } from "@visulima/pail";

/**
 * Shared CLI logger. Exported as `pail` (not `logger`) so it doesn't
 * collide with the `logger: Console` parameter that several internal
 * helpers and the cerebro Toolbox destructure.
 */
export const pail = createPail();
