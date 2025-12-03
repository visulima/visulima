import { render } from "@vue-email/render";

import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders a Vue Email component to HTML.
 * @param template The Vue component from \@vue-email/components to render.
 * @param data Data and variables to pass to the template.
 * @param options Render options including pretty formatting, plainText output, and htmlToTextOptions.
 * @returns The rendered HTML or plain text string.
 * @throws {EmailError} When \@vue-email/render is not installed or rendering fails.
 */
const vueEmail: TemplateRenderer = async (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    try {
        return await render(template as unknown as Parameters<typeof render>[0], data ?? {}, {
            htmlToTextOptions: options?.htmlToTextOptions as Record<string, unknown> | undefined,
            plainText: options?.plainText as boolean | undefined,
            pretty: options?.pretty as boolean | undefined,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("vue-email", "@vue-email/render is not installed. Please install it: pnpm add @vue-email/render", { cause: error });
        }

        throw new EmailError("vue-email", `Failed to render Vue Email component: ${(error as Error).message}`, { cause: error });
    }
};

export default vueEmail;
