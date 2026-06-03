import juice from "juice";

import EmailError from "../errors/email-error";

/**
 * Inlines `&lt;style>`/linked CSS into element `style` attributes for maximum email-client
 * compatibility, via [juice](https://github.com/Automattic/juice).
 *
 * `juice` is an optional peer dependency — install it (`pnpm add juice`) to use this.
 * @param html The HTML email.
 * @param options Options forwarded to `juice` (e.g. `preserveImportant`, `removeStyleTags`).
 * @returns The HTML with CSS inlined.
 * @throws {EmailError} When `juice` is not installed or inlining fails.
 */
const inlineCss = (html: string, options?: Record<string, unknown>): string => {
    try {
        return juice(html, options);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("render", "juice is not installed. Please install it: pnpm add juice", { cause: error });
        }

        throw new EmailError("render", `Failed to inline CSS: ${(error as Error).message}`, { cause: error });
    }
};

export default inlineCss;
