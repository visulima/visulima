import type { FC, ReactNode } from "react";

export const renderComponent = function <T>(ComponentOrNode: FC<T> | ReactNode | ((properties: T) => string), properties?: T): ReactNode {
    if (!ComponentOrNode) {
        return null;
    }

    if (typeof ComponentOrNode !== "function") {
        return ComponentOrNode;
    }

    // @ts-expect-error TS2322: Type '{}' is not assignable to type 'T'
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <ComponentOrNode {...properties} />;
};

export const renderString = function <T>(
    stringOrFunction?: string | ((properties: T) => string),
    // @ts-expect-error TS2322: Type '{}' is not assignable to type 'T'.
    properties: T = {},
): string {
    const result = typeof stringOrFunction === "function" ? stringOrFunction(properties) : stringOrFunction;

    return result ?? "";
};
