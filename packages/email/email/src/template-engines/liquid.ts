import EmailError from "../errors/email-error";
import type { TemplateRenderer } from "./types";

/**
 * Renders a [LiquidJS](https://liquidjs.com/) template to a string.
 * @param template The Liquid template string.
 * @param data The data/variables exposed to the template.
 * @param options LiquidJS engine options (passed to the `Liquid` constructor).
 * @returns The rendered output.
 * @throws {TypeError} When the template is not a string.
 * @throws {EmailError} When `liquidjs` is not installed or rendering fails.
 */
const liquid: TemplateRenderer = async (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    try {
        if (typeof template !== "string") {
            throw new TypeError("Liquid template must be a string");
        }

        // Loaded lazily so a missing optional peer surfaces here as an EmailError, not at import time.
        const { Liquid } = await import("liquidjs");
        const engine = new Liquid(options ?? {});

        return await engine.parseAndRender(template, data ?? {});
    } catch (error) {
        if (error instanceof TypeError) {
            throw error;
        }

        if (error instanceof Error && ((error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND" || error.message.includes("Cannot find module") || error.message.includes("Cannot find package"))) {
            throw new EmailError("liquid", "liquidjs is not installed. Please install it: pnpm add liquidjs", { cause: error });
        }

        throw new EmailError("liquid", `Failed to render Liquid template: ${(error as Error).message}`, { cause: error });
    }
};

export default liquid;
