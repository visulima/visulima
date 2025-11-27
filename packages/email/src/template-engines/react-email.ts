import { render } from "@react-email/render";

import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders a React Email component to HTML.
 * @param template The React component from \@react-email/components to render.
 * @param _data Data object (not used for React Email, but kept for API compatibility).
 * @param options Render options including plainText and pretty formatting.
 * @returns The rendered HTML string.
 * @throws {EmailError} When \@react-email/render is not installed or rendering fails.
 */
const reactEmail: TemplateRenderer = async (template: unknown, _data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    try {
        return await render(template as unknown as Parameters<typeof render>[0], {
            plainText: options?.plainText as boolean | undefined,
            pretty: options?.pretty as boolean | undefined,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("react-email", "@react-email/render is not installed. Please install it: pnpm add @react-email/render", { cause: error });
        }

        throw new EmailError("react-email", `Failed to render React Email component: ${(error as Error).message}`, { cause: error });
    }
};

export default reactEmail;
