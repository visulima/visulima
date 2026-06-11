import type { DurationLanguage } from "./types";

const LOCALE_CODE_REGEX = /^[a-z]{2,3}(?:_[a-z]+)*$/i;

/**
 * Lazily load a duration language pack by its locale code at runtime.
 *
 * Locales are normally imported as objects (`@visulima/humanizer/language/de`),
 * which keeps the package tree-shakeable. For apps whose locale is only known at
 * runtime, this helper dynamically imports the matching `./language/[code]`
 * subpath instead, returning the same `DurationLanguage` object the static
 * import would.
 * @example
 * ```ts
 * import { duration, loadDurationLanguage } from "@visulima/humanizer";
 *
 * const de = await loadDurationLanguage("de");
 *
 * duration(3_600_000, { language: de }); // "1 Stunde"
 * ```
 * @param code The locale code (e.g. `"de"`, `"fr"`, `"zh_CN"`). Matches a file
 * under `src/language/`.
 * @returns A promise resolving to the {@link DurationLanguage} object.
 * @throws Error if no language pack exists for the given code.
 */
const loadDurationLanguage = async (code: string): Promise<DurationLanguage> => {
    if (typeof code !== "string" || code.length === 0) {
        throw new TypeError("A non-empty locale code string is required.");
    }

    // Reject anything that is not a plain locale token to avoid resolving
    // arbitrary paths via the dynamic import specifier.
    if (!LOCALE_CODE_REGEX.test(code)) {
        throw new Error(`Invalid locale code: "${code}".`);
    }

    try {
        // The specifier is validated above to a safe locale token. The language
        // packs are emitted as separate entry chunks (`./language/*`) and resolved
        // at runtime; the build sets `rollup.dynamicVars.warnOnError` so the
        // dynamic-import-vars plugin leaves this runtime import untouched instead
        // of failing the build (no `.js` source files exist to glob). The
        // vite-ignore hint does the same for Vite/Vitest.
        // eslint-disable-next-line jsdoc/no-bad-blocks
        const module = (await import(/* @vite-ignore */ `./language/${code}.js`)) as { durationLanguage?: DurationLanguage };

        if (module.durationLanguage === undefined) {
            throw new Error(`Language pack "${code}" does not export a durationLanguage.`);
        }

        return module.durationLanguage;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith("Language pack")) {
            throw error;
        }

        throw new Error(`No duration language pack found for code "${code}".`, { cause: error });
    }
};

export default loadDurationLanguage;
