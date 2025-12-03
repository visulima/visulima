/**
 * Template render function type.
 * @param template Template content (string, React component, etc.).
 * @param data Data/variables to pass to the template.
 * @param options Options specific to the template engine.
 * @returns Rendered HTML string.
 */
export type TemplateRenderer = (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>) => string | Promise<string>;
