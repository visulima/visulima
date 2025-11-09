import { EmailError } from "../errors/email-error.js";
import type { TemplateRenderer } from "./types.js";

/**
 * Render React Email component to HTML
 * @param component - React component from @react-email/components
 * @param options - Render options
 * @returns HTML string
 */
export const renderReactEmail: TemplateRenderer = async (
    template: unknown,
    _data?: Record<string, unknown>,
    options?: Record<string, unknown>,
): Promise<string> => {
    try {
        // Dynamic import to make @react-email/render optional
        const { render } = await import("@react-email/render");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await render(template as any, {
            plainText: options?.plainText as boolean | undefined,
            pretty: options?.pretty as boolean | undefined,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError(
                "react-email",
                "@react-email/render is not installed. Please install it: pnpm add @react-email/render",
                { cause: error },
            );
        }
        throw new EmailError(
            "react-email",
            `Failed to render React Email component: ${(error as Error).message}`,
            { cause: error },
        );
    }
};
