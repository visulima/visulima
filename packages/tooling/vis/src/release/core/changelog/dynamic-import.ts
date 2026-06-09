/**
 * Dynamic import escape hatch.
 *
 * Bundlers (rollup/packem) statically analyse every `import()` call and refuse
 * variable specifiers that don't start with `./`. This helper hides the import
 * behind a function indirection so the analyser can't reach the call site.
 *
 * The only caller is `resolveFormatter` loading a user-supplied formatter
 * module by file URL. Everything else uses static `import` statements.
 */
export const dynamicEsmImport = async (url: string): Promise<unknown> => import(url);
