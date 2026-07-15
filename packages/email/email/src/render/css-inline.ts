import juice from "juice";

import EmailError from "../errors/email-error";

/**
 * Inlines `&lt;style>`/linked CSS into element `style` attributes for maximum email-client
 * compatibility, via [juice](https://github.com/Automattic/juice).
 *
 * `juice` is an optional peer dependency, and this helper is published as its own subpath
 * (`@visulima/email/render/css-inline`). Importing this module resolves `juice` eagerly, so install
 * it (`pnpm add juice`) before importing — consumers who never inline CSS simply never import this
 * entry, which keeps `juice` out of edge/worker bundles.
 * @param html The HTML email.
 * @param options Options forwarded to `juice` (e.g. `preserveImportant`, `removeStyleTags`).
 * @returns The HTML with CSS inlined.
 * @throws {EmailError} When inlining fails.
 */
const inlineCss = (html: string, options?: Record<string, unknown>): string => {
    // juice >=12 ships as an ESM-interop module (`{ __esModule: true, default: <fn> }`). Depending on
    // the bundler/runtime CJS interop the default import may be that wrapper rather than the function
    // itself, so unwrap `.default` when present.
    const juiceFunction = (juice as unknown as { default?: typeof juice }).default ?? juice;

    try {
        return juiceFunction(html, options);
    } catch (error) {
        throw new EmailError("render", `Failed to inline CSS: ${(error as Error).message}`, { cause: error });
    }
};

export default inlineCss;
