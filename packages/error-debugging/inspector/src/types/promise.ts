import type { InspectType } from "../types";

/**
 * Renders promises. Settling state and resolved value both live in internal slots that
 * cannot be read without `then`, which schedules a job and marks a pending rejection as
 * handled — so, like `util.inspect` without Node's privileged `getPromiseDetails` hook,
 * this only tags the type.
 *
 * That is also why `Promise` carries no entry in the brand table (`utils/brand-check.ts`)
 * and this inspector is reachable by a forged `Symbol.toStringTag`. Nothing here reads
 * anything off `value`, so a forgery cannot make it throw; it only mislabels. See the
 * `matchesBuiltInTag` doc comment for the alternatives that were weighed and rejected.
 */
const getPromiseValue: InspectType<Promise<unknown>> = () => "Promise{…}";

export default getPromiseValue;
