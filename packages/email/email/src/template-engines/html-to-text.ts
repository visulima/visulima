// @ts-expect-error - html-to-text doesn't have type definitions
import { convert } from "html-to-text";

import EmailError from "../errors/email-error";

/**
 * Converts HTML content to plain text format.
 * @param html The HTML string to convert.
 * @param options Configuration options for the html-to-text conversion.
 * @param options.longWordSplit Options for handling long words that exceed the word wrap limit.
 * @param options.longWordSplit.forceWrapOnLimit Whether to force wrap on the limit.
 * @param options.longWordSplit.wrapCharacters Characters to use for wrapping.
 * @param options.preserveNewlines Whether to preserve newlines in the output.
 * @param options.selectors Custom selectors for formatting specific HTML elements.
 * @param options.wordwrap The word wrap limit (number of characters) or false to disable.
 * @returns The converted plain text string.
 * @throws {EmailError} When html-to-text is not installed or conversion fails.
 */
const htmlToText = (
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

export default htmlToText;
