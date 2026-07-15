import type { EmailOptions, MaybePromise } from "../types";
import type { Middleware } from "./types";

/**
 * Wraps a transform that rewrites the message before it is sent — e.g. running the HTML through the
 * render helpers (preheader, dark-mode, CID rewrite) and the opt-in CSS inliner.
 * @param transform Maps the resolved {@link EmailOptions} to its rendered form.
 * @returns A middleware that applies the transform ahead of the provider call.
 * @example
 * ```ts
 * import { injectPreheader } from "@visulima/email/render/preheader";
 * import { addDarkModeSupport } from "@visulima/email/render/dark-mode";
 *
 * mail.use(withRender(async (email) => ({
 *   ...email,
 *   html: email.html ? addDarkModeSupport(injectPreheader(email.html, "Hi!")) : email.html,
 * })));
 * ```
 */
const withRender
    = (transform: (options: EmailOptions) => MaybePromise<EmailOptions>): Middleware =>
        async (options, next) =>
            next(await transform(options));

export default withRender;
