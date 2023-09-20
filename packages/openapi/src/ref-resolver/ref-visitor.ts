import type { ApiObject, JsonItem, ObjectVisitor, ReferenceObject, ReferenceVisitor, JsonNavigation } from "./types.d";

/**
 * Recursively walk a JSON object and invoke a callback function
 * on each `{ "$ref" : "path" }` object found
 */

// this depends on the tag being added in ApiRefResolver
const isResolved = (node: ApiObject): boolean => node !== null && typeof node === "object" && node.x__resolved__ !== undefined;

/**
 * Test if a JSON node is a `{ $ref: "uri" }` object
 */
// eslint-disable-next-line unicorn/prevent-abbreviations
export const isRef = (node: ApiObject): boolean => node !== null && typeof node === "object" && typeof (node as ReferenceObject).$ref === "string";

/**
 * Walk a JSON object or array and apply objectCallback when a JSON object is found
 * @param node a node in the OpenAPI document
 * @param objectCallback the function to call on JSON objects
 * @param nav tracks where we are in the original document
 * @return the modified (annotated) node
 */
export const walkObject = async (node: ApiObject, objectCallback: ObjectVisitor, nav?: JsonNavigation): Promise<ApiObject> => {
    const walkObject_ = async (node: ApiObject, location: JsonNavigation): Promise<ApiObject> => {
        const object = objectCallback(node, location);

        if (object !== null && typeof object === "object") {
            const keys = Object.keys(node); // make copy since this code may re-enter objects

            for (const key of keys) {
                const value = node[key];

                if (Array.isArray(value)) {
                    node[key] = await walkArray(value as [], location.with(key));
                } else if (value !== null && typeof value === "object") {
                    node[key] = await walkObject_(value, location.with(key));
                }
            }
        }
        return await object;
    };

    const walkArray = async (a: [], nav: JsonNavigation): Promise<[]> => {
        const array = a as ApiObject;

        for (let index = 0; index < a.length; index += 1) {
            const value = array[index] as ApiObject;

            if (value !== null && typeof value === "object") {
                array[index] = (await walkObject_(value, nav.with(index))) as object;
            } else if (Array.isArray(value)) {
                array[index] = (await walkArray(value as [], nav.with(index))) as [];
            }
        }
        return a;
    };

    return await walkObject_(node, nav ?? new JsonNavigation(node));
};

/**
 * Walk a JSON object and apply `refCallback` when a JSON `{$ref: url }` is found
 * @param node a node in the OpenAPI document
 * @param referenceCallback the function to call on JSON `$ref` objects
 * @param nav tracks where we are in the original document
 * @return the modified (annotated) node
 */
export const visitRefObjects = async (node: ApiObject, referenceCallback: ReferenceVisitor, nav?: JsonNavigation): Promise<ApiObject> => {
    const objectVisitor: ObjectVisitor = async (referenceNode: object, jsonNav: JsonNavigation): Promise<JsonItem> => {
        if (isRef(referenceNode)) {
            if (isResolved(referenceNode)) {
                return referenceNode;
            }

            return await referenceCallback(referenceNode as ReferenceObject, jsonNav);
        }

        return referenceNode;
    };

    return await walkObject(node, objectVisitor, nav);
};
