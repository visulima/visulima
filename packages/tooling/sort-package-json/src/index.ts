import sortPackageJsonJs from "sort-package-json";

import type { SortOptions } from "./native-binding";
import { isNativeAvailable, loadNativeBindings } from "./native-binding";

/**
 * Sorts a package.json string according to well-established npm conventions.
 *
 * Uses the native Rust binding (oxc-project/sort-package-json) when available
 * for maximum performance. Falls back to the JavaScript `sort-package-json`
 * package otherwise.
 *
 * @param contents - The raw package.json string to sort
 * @param options - Optional sorting configuration
 * @returns The sorted package.json string
 */
const sortPackageJson = (contents: string, options?: SortOptions): string => {
    const native = loadNativeBindings();

    if (native) {
        if (options) {
            return native.sortPackageJsonStringWithOptions(contents, {
                pretty: options.pretty,
                sort_scripts: options.sortScripts,
            });
        }

        return native.sortPackageJsonString(contents);
    }

    // Fallback to JavaScript implementation
    const parsed = JSON.parse(contents) as Record<string, unknown>;
    const sorted = sortPackageJsonJs(parsed);

    if (options?.pretty === false) {
        return JSON.stringify(sorted);
    }

    return JSON.stringify(sorted, null, 2) + "\n";
};

export type { SortOptions };
export { isNativeAvailable, sortPackageJson };
