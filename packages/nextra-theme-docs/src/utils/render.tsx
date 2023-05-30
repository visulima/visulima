import type { FC, ReactNode } from "react";

export function renderComponent<T>(ComponentOrNode: FC<T> | ReactNode | ((properties: T) => string), properties?: T): ReactNode {
    if (!ComponentOrNode) {
        return null;
    }

    if (typeof ComponentOrNode !== "function") {
        return ComponentOrNode;
    }

    // @ts-expect-error TS2322: Type '{}' is not assignable to type 'T'
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <ComponentOrNode {...properties} />;
}

export function renderString<T>(
    stringOrFunction?: string | ((properties: T) => string),
    // @ts-expect-error TS2322: Type '{}' is not assignable to type 'T'.
    properties: T = {},
): string {
    const result = typeof stringOrFunction === "function" ? stringOrFunction(properties) : stringOrFunction;

    return result ?? "";
}
