import jsonPointer from "json-pointer";
import deepClone from "@visulima/deep-clone";

import type { ApiObject, JsonNavigation as IJsonNavigation, JsonItem, JsonKey } from "./types.d";

/**
 * Captures a JSON document and the navigation path
 * (set of keys) used when recursively walking the JSON
 * document.
 */
class JsonNavigation implements IJsonNavigation {
    private readonly document: ApiObject;

    private keys: JsonKey[];

    public constructor(document: ApiObject, ...keys: JsonKey[]) {
        this.document = document;
        this.keys = [...keys].filter(Boolean);
    }

    /**
     * Parse a URL fragment as an array of keys
     * @param fragment the URL fragment
     * such as `#/paths/~1things/post/responses/1`.
     * @return An array of keys, such as `[ 'paths', '/things', 'post', 'responses', 1]`
     */
    public static asKeys(fragment: string): JsonKey[] {
        const keys = jsonPointer.parse(fragment.slice(1)).map((key) => {
            if (/^\d+$/.test(key)) {
                return Number.parseInt(key, 10);
            }

            return key;
        });

        return keys as JsonKey[];
    }

    /**
     * Return the document item at the JSON Pointer fragment
     * @param document A JSON object or array
     * @param fragment a URL fragment such as `'#/components/schemas/mySchema'`
     * @returns the item at the nested object specified by `fragment`, or `undefined` if
     * `fragment` is '' (or is falsy).
     */
    public static itemAtFragment(document: ApiObject, fragment: string): JsonItem | undefined {
        return new JsonNavigation(document).itemAtFragment(fragment);
    }

    /**
     * Convert the current instance's navigation path to a JSON Pointer URL fragment.
     * For example, if the current path is `[ 'paths', '/things', 'post', 'responses', 1]`,
     * return `#/paths/~1things/post/responses/1`
     *
     * @return a stringified URL fragment path
     */
    public asFragment(): string {
        const fragment = jsonPointer.compile(this.keys as string[]);

        return `#${fragment}`;
    }

    /**
     * @returns the current key in the key sequence - the name of the current JSON item
     */
    public currentKey(): JsonKey | undefined {
        return this.keys.at(-1);
    }

    /**
     * @returns `true` if the current navigation is at `/components/section/componentName`
     */
    public isAtComponent(): boolean {
        return this.keys.length === 3 && this.keys[0] === "components";
    }

    /**
     * Return the document item at the JSON Pointer fragment.
     * @param fragment a URL fragment such as `'#/components/schemas/mySchema'`
     * @returns the item at the nested object specified by `fragment`, or `undefined` if
     * `fragment` is '' (or is falsy).
     */
    public itemAtFragment(fragment: string): JsonItem | undefined {
        if (!fragment) {
            return undefined;
        }

        const noHash = fragment.slice(1);
        const value = jsonPointer(this.document, noHash);
        // To be safe, we clone objects so we do not end up with YAML &ref_0/*ref_0
        return deepClone<JsonItem>(value, {
            circles: true,
            proto: true,
        });
    }

    /**
     * Return the item accessed by a sequence of keys
     * @param keys a set of keys, such as ['components', 'schemas', 'mySchema']
     * @returns the item at the nested object specified by fragment
     */
    public itemAtPointer(keys: JsonKey[]): JsonItem {
        return jsonPointer(this.document, keys);
    }

    /**
     * @returns the current object in the document that this navigation
     * points to.
     */
    public lastItem(): JsonItem {
        return this.itemAtPointer(this.keys);
    }

    /**
     * Return the navigation keys
     * @returns The keys that navigate to this point in the JSON document
     */
    public path(): JsonKey[] {
        return [...this.keys];
    }

    /**
     * Construct and return a new nav that points to the item
     * referenced by `key` within the current document location.
     * @param key the name or index of the nested item
     * @return a new JsonNavigation instance that points to the
     * same document, but appends `key` to the path.
     */
    public with(key: JsonKey): JsonNavigation {
        const newNav = new JsonNavigation(this.document);

        newNav.keys = [...this.keys]; // make a safe copy
        newNav.keys.push(key);

        return newNav;
    }
}

export default JsonNavigation;
