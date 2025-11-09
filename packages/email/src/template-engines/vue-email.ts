import { render } from "@vue-email/render";

import { EmailError } from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Render Vue Email component to HTML
 * @param component Vue component from @vue-email/components
 * @param data Data/variables to pass to the template
 * @param options Render options (pretty, plainText, htmlToTextOptions)
 * @returns HTML or plain text string
 */
export const renderVueEmail: TemplateRenderer = async (
    template: unknown,
    data?: Record<string, unknown>,
    options?: Record<string, unknown>,
): Promise<string> => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await render(template as any, data ?? {}, {
            pretty: options?.pretty as boolean | undefined,
            plainText: options?.plainText as boolean | undefined,
            htmlToTextOptions: options?.htmlToTextOptions as Record<string, unknown> | undefined,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("vue-email", "@vue-email/render is not installed. Please install it: pnpm add @vue-email/render", { cause: error });
        }

        throw new EmailError("vue-email", `Failed to render Vue Email component: ${(error as Error).message}`, { cause: error });
    }
};

