import { render } from "@react-email/render";

import { EmailError } from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders React Email component to HTML.
 * @param template React component from @react-email/components.
 * @param _data Data (not used for React Email).
 * @param options Render options (plainText, pretty).
 * @returns HTML string.
 * @throws {EmailError} When @react-email/render is not installed or rendering fails.
 */
const renderReactEmail: TemplateRenderer = async (template: unknown, _data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await render(template as any, {
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

export default renderReactEmail;
