import deepClone from "@visulima/deep-clone";

import { ApiObject } from "./../types";

/**
 * Merge the `$ref` object with the API object read from the URL.
 * For example, when resolving the reference in the following:
 *
 * ```
 * { components: {
 *     responses: {
 *       '422':
 *         description: "Describes the error",
 *         $ref: "#/components/schemas/problemResponse"
 *     }
 *   }
 * }
 * ```
 *
 * `refObject` is the `{ description: "...", $ref: "#/components/schemas/problemResponse" }` object.
 * Note that we can't simply _replace_ the entire `$ref` object with the API object at the URL;
 * that would lose the "description".
 * Instead, we delete the `$ref` from the `refObject` within the API document,
 * then merge in any additional properties from the original `refObject` into the API document
 * (if it is an object).
 *
 * @param refObject a `$ref` object
 * @param apiElement the API element read from the `url`
 */
const mergeReferenceObject = (referenceObject: ReferenceObject, apiElement: JsonItem): ApiObject => {
    if (typeof apiElement !== "object") {
        return;
    }

    const referenceProperties = { ...referenceObject };
    delete referenceProperties.$ref;
    // matching properties from refProperties will override those from apiElement
    // Clone the object to prevent injection of YAML *ref_0 / &ref_0 objects
    // in case this element is referenced multiple times
    const clone = deepClone(apiElement, {
        circles: true,
        proto: true,
    });

    return { ...clone, ...referenceProperties };
};

export default mergeReferenceObject;
