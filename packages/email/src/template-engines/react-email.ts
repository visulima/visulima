import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { EmailError } from "../errors/email-error.js";

/**
 * Render React Email component to HTML
 * @param component - React component from @react-email/components
 * @param options - Render options
 * @returns HTML string
 */
export const renderReactEmail = async (
    component: ReactElement,
    options?: {
        plainText?: boolean;
        pretty?: boolean;
    },
): Promise<string> => {
    try {
        if (options?.plainText) {
            return await render(component, { plainText: true });
        }
        return await render(component, { pretty: options?.pretty ?? false });
    } catch (error) {
        throw new EmailError(
            "react-email",
            `Failed to render React Email component: ${(error as Error).message}`,
            { cause: error },
        );
    }
};
