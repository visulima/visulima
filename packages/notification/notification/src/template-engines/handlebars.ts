import NotificationError from "../errors/notification-error";
import type { TemplateRenderer } from "./types";

/**
 * Minimal structural type for the part of the `handlebars` module this renderer uses.
 * Declared locally so the optional peer's own types are not required at build time.
 */
interface HandlebarsModule {
    compile: (template: string, options?: Record<string, unknown>) => (data: Record<string, unknown>) => string;
}

/**
 * Renders a [Handlebars](https://handlebarsjs.com/) template to a string.
 *
 * `handlebars` is an optional peer, loaded lazily so a missing install surfaces here
 * as a {@link NotificationError} rather than at import time. Pure JS — edge-safe and
 * runnable on Cloudflare Workers.
 * @param template The Handlebars template string.
 * @param data The data/variables exposed to the template.
 * @param options Handlebars compile options.
 * @returns The rendered string.
 * @throws {TypeError} When the template is not a string.
 * @throws {NotificationError} When `handlebars` is not installed or rendering fails.
 */
export const renderHandlebars: TemplateRenderer = async (
    template: unknown,
    data?: Record<string, unknown>,
    options?: Record<string, unknown>,
): Promise<string> => {
    if (typeof template !== "string") {
        throw new TypeError("Handlebars template must be a string");
    }

    let handlebars: HandlebarsModule;

    try {
        // Literal specifier so the bundler externalises the optional peer (it is not
        // bundled, but the import is statically analysable).
        const module = (await import("handlebars")) as unknown as HandlebarsModule & { default?: HandlebarsModule };

        handlebars = module.default ?? module;
    } catch (error) {
        throw new NotificationError("handlebars", "handlebars is not installed. Please install it: pnpm add handlebars", { cause: error });
    }

    try {
        const compiled = handlebars.compile(template, options);

        return compiled(data ?? {});
    } catch (error) {
        throw new NotificationError("handlebars", `Failed to render Handlebars template: ${(error as Error).message}`, { cause: error });
    }
};

export default renderHandlebars;
