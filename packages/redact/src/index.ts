import type { Modifier } from "typescript";

import { objectModifier } from "./object-modifier";
import { stringAnonymize } from "./string-anonymizer";
import { clone } from "./utils/simple-clone";

type Options = {
    modifier: Modifier;
    strictCopy?: boolean;
};

const recursiveFilter = <V, R = V>(input: V, options?: Options): R => {
    if (typeof input === "object") {
        objectModifier<V>(input as V, options.modifier, (value, modifier) => recursiveFilter<V, R>(value as V, { ...options, modifier }));

        return input as unknown as R;
    }

    if (Array.isArray(input)) {
        const copy: unknown[] = [];

        // eslint-disable-next-line no-loops/no-loops
        for (let inputKeysIndex = 0; inputKeysIndex < input.length; ) {
            // const value = input[inputKeysIndex];

            // const filter = options?.filters?.find((f) => f.isApplicable(value, inputKeysIndex));
            //
            // // eslint-disable-next-line security/detect-object-injection,@typescript-eslint/no-unsafe-argument
            // copy[inputKeysIndex] = filter ? filter.transform(value) : recursiveFilter<V, R>(value, options);

            // eslint-disable-next-line no-plusplus
            inputKeysIndex++;
        }

        return copy as unknown as R;
    }

    if (input instanceof Error) {
    }

    if (typeof input === "string") {
        return stringAnonymize(input, options.modifier) as unknown as R;
    }

    return input as unknown as R;
};

export function redact<V = string, R = V>(input: V, options?: Options): R;
export function redact<V = Error, R = V>(input: V, options?: Options): R;
export function redact<V = Record<string, unknown>, R = V>(input: V, options?: Options): R;
export function redact<V = unknown[], R = V>(input: V, options?: Options): R;
export function redact<V = Map<unknown, unknown>, R = V>(input: V, options?: Options): R;
export function redact<V = Set<unknown>, R = V>(input: V, options?: Options): R;

// eslint-disable-next-line func-style,import/no-unused-modules
export function redact<V, R>(input: V, options?: Options): R {
    if (typeof input === "string" || typeof input === "object" || Array.isArray(input)) {
        const copy = clone(input);

        return recursiveFilter<V, R>(copy, options);
    }

    return input as unknown as R;
}
