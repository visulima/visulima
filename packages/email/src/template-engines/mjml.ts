import { EmailError } from "../errors/email-error.js";
import type { TemplateRenderer } from "./types.js";

/**
 * Render MJML to HTML
 * @param mjml - MJML template string
 * @param options - MJML options
 * @returns Rendered HTML string
 */
export const renderMjml: TemplateRenderer = (
    template: unknown,
    _data?: Record<string, unknown>,
    options?: Record<string, unknown>,
): string => {
    try {
        // Dynamic import to make mjml optional
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mjml2html = require("mjml");

        if (typeof template !== "string") {
            throw new Error("MJML template must be a string");
        }

        const result = mjml2html(template, {
            fonts: options?.fonts as Record<string, string> | undefined,
            keepComments: options?.keepComments ?? true,
            beautify: options?.beautify ?? false,
            minify: options?.minify ?? false,
            validationLevel: (options?.validationLevel as "strict" | "soft" | "skip") ?? "soft",
        });

        if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors.map((e: { message: string }) => e.message).join("; ");
            throw new EmailError("mjml", `MJML validation errors: ${errorMessages}`);
        }

        return result.html;
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError(
                "mjml",
                "MJML is not installed. Please install it: pnpm add mjml",
                { cause: error },
            );
        }
        if (error instanceof EmailError) {
            throw error;
        }
        throw new EmailError(
            "mjml",
            `Failed to render MJML: ${(error as Error).message}`,
            { cause: error },
        );
    }
};
