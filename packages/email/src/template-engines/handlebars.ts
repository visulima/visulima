import Handlebars from "handlebars";

import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders Handlebars template.
 * @param template Handlebars template string.
 * @param data Data to pass to the template.
 * @param options Handlebars compile options.
 * @returns Rendered HTML string.
 * @throws {TypeError} When template is not a string.
 * @throws {EmailError} When Handlebars is not installed or rendering fails.
 */
export const renderHandlebars: TemplateRenderer = (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>): string => {
    try {
        if (typeof template !== "string") {
            throw new TypeError("Handlebars template must be a string");
        }

        const compiled = Handlebars.compile(template, options);

        return compiled(data || {});
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("handlebars", "Handlebars is not installed. Please install it: pnpm add handlebars", { cause: error });
        }

        throw new EmailError("handlebars", `Failed to render Handlebars template: ${(error as Error).message}`, { cause: error });
    }
};

/**
 * Registers a Handlebars helper function for use in templates.
 * @param name The name of the helper to register.
 * @param helper The helper function to register.
 * @throws {EmailError} When Handlebars is not installed.
 */
export const registerHandlebarsHelper = (name: string, helper: unknown): void => {
    try {
        Handlebars.registerHelper(name, helper as Handlebars.HelperDelegate);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("handlebars", "Handlebars is not installed. Please install it: pnpm add handlebars", { cause: error });
        }

        throw error;
    }
};

/**
 * Registers a Handlebars partial template for reuse in other templates.
 * @param name The name of the partial to register.
 * @param partial The partial template string to register.
 * @throws {EmailError} When Handlebars is not installed.
 */
export const registerHandlebarsPartial = (name: string, partial: string): void => {
    try {
        Handlebars.registerPartial(name, partial);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("handlebars", "Handlebars is not installed. Please install it: pnpm add handlebars", { cause: error });
        }

        throw error;
    }
};
