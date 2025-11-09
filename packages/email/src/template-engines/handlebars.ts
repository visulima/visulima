// eslint-disable-next-line @typescript-eslint/no-require-imports
const Handlebars = require("handlebars");
import type { CompileOptions, HelperDelegate } from "handlebars";
import { EmailError } from "../errors/email-error.js";

/**
 * Render Handlebars template
 * @param template - Handlebars template string
 * @param data - Data to pass to the template
 * @param options - Handlebars compile options
 * @returns Rendered HTML string
 */
export const renderHandlebars = (
    template: string,
    data?: Record<string, unknown>,
    options?: CompileOptions,
): string => {
    try {
        const compiled = Handlebars.compile(template, options);
        return compiled(data || {});
    } catch (error) {
        throw new EmailError(
            "handlebars",
            `Failed to render Handlebars template: ${(error as Error).message}`,
            { cause: error },
        );
    }
};

/**
 * Register a Handlebars helper
 * @param name - Helper name
 * @param helper - Helper function
 */
export const registerHandlebarsHelper = (name: string, helper: HelperDelegate): void => {
    Handlebars.registerHelper(name, helper);
};

/**
 * Register Handlebars partial
 * @param name - Partial name
 * @param partial - Partial template string
 */
export const registerHandlebarsPartial = (name: string, partial: string): void => {
    Handlebars.registerPartial(name, partial);
};
