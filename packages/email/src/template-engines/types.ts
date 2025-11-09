/**
 * Template engine type
 */
export type TemplateEngine = "react-email" | "handlebars" | "mjml" | "html";

/**
 * Template options for rendering
 */
export interface TemplateOptions {
    /**
     * Template engine to use
     */
    engine?: TemplateEngine;

    /**
     * Template content (string, React component, Handlebars template, or MJML)
     */
    template: string | unknown;

    /**
     * Data/variables to pass to the template
     */
    data?: Record<string, unknown>;

    /**
     * Options specific to the template engine
     */
    options?: Record<string, unknown>;
}
