import Handlebars from "handlebars";

import { EmailError } from "../errors/email-error";
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
 * Registers a Handlebars helper.
 * @param name Helper name.
 * @param helper Helper function.
 * @throws {EmailError} When Handlebars is not installed.
 */
export const registerHandlebarsHelper = (name: string, helper: unknown): void => {
    try {
        Handlebars.registerHelper(name, helper);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("handlebars", "Handlebars is not installed. Please install it: pnpm add handlebars", { cause: error });
        }

        throw error;
    }
};

/**
 * Registers Handlebars partial.
 * @param name Partial name.
 * @param partial Partial template string.
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
