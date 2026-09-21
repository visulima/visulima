/**
 * Resolving the two dynamic parts of a spec: `visible` conditions and props
 * bound to state.
 *
 * The shapes mirror the `$state` wire format so a spec stays portable.
 */
import type { StateModel } from "./state-store";
import { getByPath } from "./state-store";

/** A prop written as `{ $state: "/path" }` reads from the state model. */
export interface StateBinding {
    $state: string;
}

/**
 * A visibility condition.
 *
 * `true`/`false` are literal; `{ $state }` is a truthiness test on the value
 * at that path, narrowed by at most one comparison, and `not` inverts the
 * result of whichever test ran.
 */
export type VisibilityCondition
    = | boolean
        | (StateBinding & {
            eq?: unknown;
            neq?: unknown;
            not?: boolean;
        });

const isBinding = (value: unknown): value is StateBinding => typeof value === "object" && value !== null && typeof (value as StateBinding).$state === "string";

/** `undefined` means visible — an element without a condition always renders. */
export const evaluateVisibility = (condition: VisibilityCondition | undefined, stateModel: StateModel): boolean => {
    if (condition === undefined) {
        return true;
    }

    if (typeof condition === "boolean") {
        return condition;
    }

    const value = getByPath(stateModel, condition.$state);
    let result: boolean;

    if ("eq" in condition) {
        result = value === condition.eq;
    } else if ("neq" in condition) {
        result = value !== condition.neq;
    } else {
        result = Boolean(value);
    }

    return condition.not === true ? !result : result;
};

/** Replace every `{ $state }` prop with the value it points at. */
export const resolveElementProps = (properties: Record<string, unknown>, stateModel: StateModel): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(properties)) {
        resolved[key] = isBinding(value) ? getByPath(stateModel, value.$state) : value;
    }

    return resolved;
};
