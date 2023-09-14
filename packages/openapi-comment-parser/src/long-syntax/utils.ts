import type { Spec } from "comment-parser";
// eslint-disable-next-line no-restricted-imports
import mergeWith from "lodash.mergewith";

/**
 * A recursive deep-merge that ignores null values when merging.
 * This returns the merged object and does not mutate.
 * @param {object} first the first object to get merged
 * @param {object} second the second object to get merged
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
export const mergeDeep = (first?: object, second?: object): object => mergeWith({}, first, second, (a, b) => (b === null ? a : undefined));

/**
 * Checks if there is any properties of the input object which are an empty object
 * @param {object} object - the object to check
 * @returns boolean
 */
export const hasEmptyProperty = (object: Record<string, any>): boolean =>
    Object.keys(object)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .map((key) => object[key])
        .every((keyObject) => typeof keyObject === "object" && Object.keys(keyObject).every((key) => !(key in keyObject)));

/**
 * @param {object} tag
 * @param {array} tags
 * @returns boolean
 */
export const isTagPresentInTags = (tag: Spec, tags: Spec[]): boolean => tags.some((targetTag) => tag.name === targetTag.name);

export const getSwaggerVersionFromSpec = (tag: Spec): "v2" | "v3" => {
    switch (tag.tag) {
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
