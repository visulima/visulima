import { render } from "jsx-email";

import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders a [jsx-email](https://jsx.email/) component to HTML.
 * @param template The jsx-email component element to render.
 * @param _data Data object (unused; jsx-email components receive props directly).
 * @param options Render options (`plainText`, `pretty`).
 * @returns The rendered HTML (or plain text) string.
 * @throws {EmailError} When `jsx-email` is not installed or rendering fails.
 */
const jsxEmail: TemplateRenderer = async (template: unknown, _data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    try {
        return await render(template as Parameters<typeof render>[0], {
            plainText: options?.plainText as boolean | undefined,
            pretty: options?.pretty as boolean | undefined,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find module")) {
            throw new EmailError("jsx-email", "jsx-email is not installed. Please install it: pnpm add jsx-email", { cause: error });
        }

        throw new EmailError("jsx-email", `Failed to render jsx-email component: ${(error as Error).message}`, { cause: error });
    }
};

export default jsxEmail;
