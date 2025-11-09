import { EmailError } from "../errors/email-error.js";

/**
 * Convert HTML to plain text
 * @param html - HTML string
 * @param options - html-to-text options
 * @returns Plain text string
 */
export const htmlToText = (
    html: string,
    options?: {
        wordwrap?: number | false;
        preserveNewlines?: boolean;
        longWordSplit?: {
            wrapCharacters?: string[];
            forceWrapOnLimit?: boolean;
        };
        selectors?: Array<{
            selector: string;
            format?: string;
            options?: Record<string, unknown>;
        }>;
    },
): string => {
    try {
        // Dynamic import to make html-to-text optional
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { convert } = require("html-to-text");

        return convert(html, {
            wordwrap: options?.wordwrap ?? 80,
            preserveNewlines: options?.preserveNewlines ?? false,
            longWordSplit: options?.longWordSplit,
            selectors: options?.selectors,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError(
                "html-to-text",
                "html-to-text is not installed. Please install it: pnpm add html-to-text",
                { cause: error },
            );
        }
        throw new EmailError(
            "html-to-text",
            `Failed to convert HTML to text: ${(error as Error).message}`,
            { cause: error },
        );
    }
};
