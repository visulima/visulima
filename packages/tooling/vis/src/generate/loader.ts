/**
 * Native template loader.
 *
 * Native templates live as `.ts`/`.js`/`.mjs` modules under
 * `&lt;workspace>/.vis/templates/&lt;name>.&lt;ext>` and export a `Template` as
 * their default export. We use jiti so TypeScript and ESM/CJS
 * interop both work without a separate build step.
 */

import { dirname } from "@visulima/path";
import { createJiti } from "jiti";

import type { Template } from "./types";

/**
 * Validate a loaded module's default export looks like a `Template`.
 * Throws with a clear message when fields are missing.
 */
const validateTemplateExport = (path: string, value: unknown): Template => {
    if (!value || typeof value !== "object") {
        throw new TypeError(`${path}: default export must be an object (got ${value === null ? "null" : typeof value}). Use createTemplate({ ... }).`);
    }

    const candidate = value as Record<string, unknown>;

    if (typeof candidate.about !== "object" || candidate.about === null) {
        throw new TypeError(`${path}: default export missing required "about" object`);
    }

    if (typeof candidate.produce !== "function") {
        throw new TypeError(`${path}: default export missing required "produce" function`);
    }

    return value as Template;
};

/**
 * Load a native template module from disk and return its default export.
 * The directory containing the file is used as jiti's working dir so
 * relative imports inside the template resolve as the author expects.
 */
export const loadNativeTemplate = async (path: string): Promise<Template> => {
    const jiti = createJiti(dirname(path), { fsCache: false, moduleCache: false });
    const loaded = (await jiti.import(path, { default: true, try: true })) ?? null;

    return validateTemplateExport(path, loaded);
};
