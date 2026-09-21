import type { JsonViewAction } from "./types";

/**
 * Flip the boolean at `path`.
 *
 * Lets a spec drive a disclosure without a stateful component: bind the body's
 * `visible` to the same path the header's `toggle` writes.
 */
const toggle: JsonViewAction = (parameters, store) => {
    const { path } = parameters;

    if (typeof path !== "string") {
        return;
    }

    store.set(path, !store.get(path));
};

/** Actions every view can rely on, to be spread under an app's own handlers. */
const baseActions: Record<string, JsonViewAction> = { toggle };

export default baseActions;
