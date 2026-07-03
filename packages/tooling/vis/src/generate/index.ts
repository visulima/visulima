/**
 * Public surface for `vis generate` template authors.
 *
 * Native templates live at `&lt;workspace>/.vis/templates/&lt;name>.{ts,js,mjs}`
 * and import `createTemplate` from this module.
 * @example
 * ```typescript
 * import { createTemplate } from "@visulima/vis/generate";
 *
 * export default createTemplate({
 *     about: { name: "package", description: "Scaffold a new package" },
 *     options: {
 *         name: { type: "string", required: true, prompt: "Package name?" },
 *     },
 *     async produce({ options }) {
 *         return {
 *             files: {
 *                 [`packages/${options.name}/package.json`]: JSON.stringify({ name: options.name }, null, 2),
 *                 [`packages/${options.name}/src/index.ts`]: "export {};\n",
 *             },
 *         };
 *     },
 * });
 * ```
 */

import type { Template } from "./types";

/**
 * Identity helper for type inference. Authors get autocomplete + checks
 * without having to annotate the export.
 */
export const createTemplate = (template: Template): Template => template;

export type {
    ArrayVariable,
    BooleanVariable,
    BuiltinVars,
    Creation,
    CreationDirectory,
    CreationFile,
    DiscoveredTemplate,
    EnumVariable,
    FileMeta,
    NumberVariable,
    Options,
    Script,
    ScriptObject,
    StringVariable,
    Template,
    TemplateAbout,
    TemplateContext,
    Variable,
    VariableMap,
    VariableType,
} from "./types";
