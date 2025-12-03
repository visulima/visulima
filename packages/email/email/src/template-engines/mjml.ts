import mjml2html from "mjml";

import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders MJML to HTML.
 * @param template MJML template string.
 * @param _data Data (not used for MJML).
 * @param options MJML options (beautify, fonts, keepComments, minify, validationLevel).
 * @returns Rendered HTML string.
 * @throws {TypeError} When template is not a string.
 * @throws {EmailError} When MJML is not installed, validation fails, or rendering fails.
 */
const mjml: TemplateRenderer = (template: unknown, _data?: Record<string, unknown>, options?: Record<string, unknown>): string => {
    try {
        if (typeof template !== "string") {
            throw new TypeError("MJML template must be a string");
        }

        const result = mjml2html(template, {
            beautify: (options?.beautify as boolean | undefined) ?? false,
            fonts: options?.fonts as Record<string, string> | undefined,
            keepComments: (options?.keepComments as boolean | undefined) ?? true,
            minify: (options?.minify as boolean | undefined) ?? false,
            validationLevel: (options?.validationLevel as "strict" | "soft" | "skip") ?? "soft",
        });

        if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors.map((error: { message: string }) => error.message).join("; ");

            throw new EmailError("mjml", `MJML validation errors: ${errorMessages}`);
        }

        return result.html;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("mjml", "MJML is not installed. Please install it: pnpm add mjml", { cause: error });
        }

        if (error instanceof EmailError) {
            throw error;
        }

        throw new EmailError("mjml", `Failed to render MJML: ${(error as Error).message}`, { cause: error });
    }
};

export default mjml;
