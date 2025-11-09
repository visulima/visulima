import { convert } from "html-to-text";

import { EmailError } from "../errors/email-error.js";

/**
 * Convert HTML to plain text
 * @param html HTML string
 * @param options html-to-text options
 * @returns Plain text string
 */
export const htmlToText = (
    html: string,
    options?: {
        longWordSplit?: {
            forceWrapOnLimit?: boolean;
            wrapCharacters?: string[];
        };
        preserveNewlines?: boolean;
        selectors?: {
            format?: string;
            options?: Record<string, unknown>;
            selector: string;
        }[];
        wordwrap?: number | false;
    },
): string => {
    try {
        return convert(html, {
            longWordSplit: options?.longWordSplit,
            preserveNewlines: options?.preserveNewlines ?? false,
            selectors: options?.selectors,
            wordwrap: options?.wordwrap ?? 80,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("html-to-text", "html-to-text is not installed. Please install it: pnpm add html-to-text", { cause: error });
        }

        throw new EmailError("html-to-text", `Failed to convert HTML to text: ${(error as Error).message}`, { cause: error });
    }
};
