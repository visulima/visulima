export type { EscapeHtmlOptions } from "./escaping";
export { default as escapeHtml } from "./escaping";
// eslint-disable-next-line import/no-extraneous-dependencies
export * from "html-entities";
// eslint-disable-next-line import/no-extraneous-dependencies
export { default as htmlTags, voidHtmlTags } from "html-tags";
// @ts-expect-error the bundler will transform it correctly
export * as sanitizeHtml from "sanitize-html";
