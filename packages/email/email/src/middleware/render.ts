import type { EmailOptions, MaybePromise } from "../types";
import type { Middleware } from "./types";

/**
 * Wraps a transform that rewrites the message before it is sent — e.g. running the HTML through the
 * `@visulima/email/render` post-processing pipeline (preheader, CID rewrite, dark-mode, CSS inline).
 * @param transform Maps the resolved {@link EmailOptions} to its rendered form.
 * @returns A middleware that applies the transform ahead of the provider call.
 * @example
 * ```ts
 * import { postProcessHtml } from "@visulima/email/render";
 *
 * mail.use(withRender(async (email) => ({
 *   ...email,
 *   html: email.html ? postProcessHtml(email.html, { preheader: "Hi!", darkMode: true }) : email.html,
 * })));
 * ```
 */
const withRender = (transform: (options: EmailOptions) => MaybePromise<EmailOptions>): Middleware =>
    async (options, next) => next(await transform(options));

export default withRender;
