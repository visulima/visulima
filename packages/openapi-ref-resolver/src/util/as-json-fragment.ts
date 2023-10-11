import jsonPointer from "json-pointer";

/**
 * Convert an array of keys to a JSON Pointer URL fragment.
 * For example, for the keys `[ 'paths', '/things', 'post', 'responses', 1]`,
 * return `#/paths/~1things/post/responses/1`
 * @param keys an array of JSON keys
 * @param withHash if true, include the `#` prefix
 * @return a stringified URL fragment path
 */
const asJsonFragment = (keys: string[], withHash = false): string => {
    const fragment = jsonPointer.compile(keys);

    return withHash ? `#${fragment}` : fragment;
};

export default asJsonFragment;
