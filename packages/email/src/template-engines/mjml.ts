import { EmailError } from "../errors/email-error.js";

// Dynamic import for mjml to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mjml2html = require("mjml");

/**
 * Render MJML to HTML
 * @param mjml - MJML template string
 * @param options - MJML options
 * @returns Rendered HTML string
 */
export const renderMjml = (
    mjml: string,
    options?: {
        fonts?: Record<string, string>;
        keepComments?: boolean;
        beautify?: boolean;
        minify?: boolean;
        validationLevel?: "strict" | "soft" | "skip";
    },
): string => {
    try {
        const result = mjml2html(mjml, {
            fonts: options?.fonts,
            keepComments: options?.keepComments ?? true,
            beautify: options?.beautify ?? false,
            minify: options?.minify ?? false,
            validationLevel: options?.validationLevel ?? "soft",
        });

        if (result.errors && result.errors.length > 0) {
            const errorMessages = result.errors.map((e) => e.message).join("; ");
            throw new EmailError("mjml", `MJML validation errors: ${errorMessages}`);
        }

        return result.html;
    } catch (error) {
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
