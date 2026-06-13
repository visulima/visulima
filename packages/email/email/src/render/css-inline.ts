import { createRequire } from "node:module";

import type juice from "juice";

import EmailError from "../errors/email-error";

const require = createRequire(import.meta.url);

/**
 * Inlines `&lt;style>`/linked CSS into element `style` attributes for maximum email-client
 * compatibility, via [juice](https://github.com/Automattic/juice).
 *
 * `juice` is an optional peer dependency — install it (`pnpm add juice`) to use this. It is loaded
 * lazily (via `createRequire`) so importing the render entry point doesn't fail when `juice` is absent.
 * @param html The HTML email.
 * @param options Options forwarded to `juice` (e.g. `preserveImportant`, `removeStyleTags`).
 * @returns The HTML with CSS inlined.
 * @throws {EmailError} When `juice` is not installed or inlining fails.
 */
const inlineCss = (html: string, options?: Record<string, unknown>): string => {
    let juiceFunction: typeof juice;

    try {
        // juice >=12 ships as an ESM-interop module: `require("juice")` returns
        // `{ __esModule: true, default: <fn> }` rather than the function itself.
        // Unwrap `.default` when present so both old and new layouts work.
        const loaded = require("juice") as typeof juice | { default: typeof juice };

        juiceFunction = (loaded as { default?: typeof juice }).default ?? (loaded as typeof juice);
    } catch (error) {
        if (
            error instanceof Error
            && ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND"
                || error.message.includes("Cannot find module")
                || error.message.includes("Cannot find package"))
        ) {
            throw new EmailError("render", "juice is not installed. Please install it: pnpm add juice", { cause: error });
        }

        throw new EmailError("render", `Failed to load juice: ${(error as Error).message}`, { cause: error });
    }

    try {
        return juiceFunction(html, options);
    } catch (error) {
        throw new EmailError("render", `Failed to inline CSS: ${(error as Error).message}`, { cause: error });
    }
};

export default inlineCss;
