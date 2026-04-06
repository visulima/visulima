import type { Spec } from "comment-parser";
// eslint-disable-next-line no-restricted-imports,e18e/ban-dependencies
import mergeWith from "lodash.mergewith";

/**
 * A recursive deep-merge that ignores null values when merging.
 * This returns the merged object and does not mutate.
 * @param first the first object to get merged
 * @param second the second object to get merged
 */
export const mergeDeep = (first?: object, second?: object): object =>
    // eslint-disable-next-line @stylistic/no-extra-parens
    mergeWith({}, first, second, (a: unknown, b: unknown) => (b === null ? a : undefined));

/**
 * Checks if there is any properties of the input object which are an empty object.
 * @param object the object to check
 * @returns boolean
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hasEmptyProperty = (object: Record<string, any>): boolean =>
    Object.keys(object)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .map((key) => object[key])
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        .every((keyObject) => typeof keyObject === "object" && Object.keys(keyObject).every((key) => !(key in keyObject)));

/**
 * @param tag the tag to check
 * @param tags the tags to check against
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
