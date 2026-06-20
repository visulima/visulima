import NotificationError from "../errors/notification-error";
import type { TemplateRenderer } from "./types";

/**
 * Minimal structural type for the part of the `liquidjs` module this renderer uses.
 * Declared locally so the optional peer's own types are not required at build time.
 */
interface LiquidEngine {
    parseAndRender: (template: string, data: Record<string, unknown>) => Promise<string>;
}

interface LiquidModule {
    Liquid: new (options?: Record<string, unknown>) => LiquidEngine;
}

/**
 * Renders a [LiquidJS](https://liquidjs.com/) template to a string.
 *
 * `liquidjs` is an optional peer, loaded lazily so a missing install surfaces here as
 * a {@link NotificationError} rather than at import time. Pure JS — edge-safe and
 * runnable on Cloudflare Workers.
 * @param template The Liquid template string.
 * @param data The data/variables exposed to the template.
 * @param options LiquidJS engine options (passed to the `Liquid` constructor).
 * @returns The rendered output.
 * @throws {TypeError} When the template is not a string.
 * @throws {NotificationError} When `liquidjs` is not installed or rendering fails.
 */
export const renderLiquid: TemplateRenderer = async (template: unknown, data?: Record<string, unknown>, options?: Record<string, unknown>): Promise<string> => {
    if (typeof template !== "string") {
        throw new TypeError("Liquid template must be a string");
    }

    let liquid: LiquidModule;

    try {
        // Literal specifier so the bundler externalises the optional peer (it is not
        // bundled, but the import is statically analysable).
        liquid = await import("liquidjs");
    } catch (error) {
        throw new NotificationError("liquid", "liquidjs is not installed. Please install it: pnpm add liquidjs", { cause: error });
    }

    try {
        const engine = new liquid.Liquid(options ?? {});

        return await engine.parseAndRender(template, data ?? {});
    } catch (error) {
        throw new NotificationError("liquid", `Failed to render Liquid template: ${(error as Error).message}`, { cause: error });
    }
};

export default renderLiquid;
