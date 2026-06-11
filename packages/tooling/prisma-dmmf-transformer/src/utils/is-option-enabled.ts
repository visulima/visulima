import type { BooleanLike } from "../types";

/**
 * Normalize a {@link BooleanLike} option to a real boolean.
 *
 * Accepts the historic Prisma generator-config strings (`"true"` / `"false"`)
 * as well as native booleans, so that programmatic callers passing
 * `{ includeRequiredFields: true }` are no longer silently ignored.
 */
const isOptionEnabled = (value: BooleanLike | undefined): boolean => value === true || value === "true";

export default isOptionEnabled;
