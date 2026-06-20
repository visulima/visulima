/**
 * Template render function type. Engines accept a template, optional data and
 * engine-specific options and return the rendered string (sync or async).
 * @param template Template content (typically a string).
 * @param data Data/variables to pass to the template.
 * @param options Options specific to the template engine.
 * @returns The rendered string.
 */
export type TemplateRenderer = (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>) => string | Promise<string>;
