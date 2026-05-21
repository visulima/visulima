import type { Spec } from "comment-parser";
import { mergeWith } from "es-toolkit";

const ignoreNullCustomizer = (a: unknown, b: unknown): unknown => {
    if (b === null) {
        return a;
    }

    return undefined;
};

/**
 * A recursive deep-merge that ignores null values when merging.
 * Returns a new top-level merged object. Note: nested objects inside `first`
 * may still be mutated because their references are shared with the returned
 * target during the deep merge — pass cloned inputs if you need full
 * immutability.
 * @param first the first object to get merged
 * @param second the second object to get merged
 */
export const mergeDeep = (first?: object, second?: object): object => {
    const target = mergeWith({} as Record<string, any>, (first ?? {}) as Record<string, any>, ignoreNullCustomizer);

    return mergeWith(target, (second ?? {}) as Record<string, any>, ignoreNullCustomizer);
};

/**
 * Checks if there is any properties of the input object which are an empty object.
 * @param object the object to check
 * @returns boolean
 */
export const hasEmptyProperty = (object: Record<string, any>): boolean =>
    Object.keys(object)
        .map((key) => object[key])
        .every((keyObject) => typeof keyObject === "object" && Object.keys(keyObject).every((key) => !(key in keyObject)));

/**
 * Checks whether the given tag is present in tags.
 * @param tag
 * @param tags
 * @returns boolean
 */
export const isTagPresentInTags = (tag: Spec, tags: Spec[]): boolean => tags.some((targetTag) => tag.name === targetTag.name);

export const getSwaggerVersionFromSpec = (tag: Spec): "v2" | "v3" | "v4" => {
    switch (tag.tag) {
        case "asyncapi": {
            return "v4";
        }
        case "openapi": {
            return "v3";
        }
        case "swagger": {
            return "v2";
        }
        default: {
            return "v2";
        }
    }
};
