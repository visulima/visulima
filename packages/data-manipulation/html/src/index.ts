export type { CSSProperties, FlexibleCSSProperties } from "./css";
export { default as css } from "./css";
export { default as escapeHtml } from "./escape-html";
export type { RawHtml } from "./html";
export { default as html, isRawHtml } from "./html";

// eslint-disable-next-line import/no-extraneous-dependencies
export { escapeCss } from "@std/html/unstable-escape-css";
// eslint-disable-next-line import/no-extraneous-dependencies
export { escapeJs } from "@std/html/unstable-escape-js";
// eslint-disable-next-line import/no-extraneous-dependencies
export { isValidCustomElementName } from "@std/html/unstable-is-valid-custom-element-name";
// eslint-disable-next-line import/no-extraneous-dependencies
export * from "html-entities";
// eslint-disable-next-line import/no-extraneous-dependencies
export { default as htmlTags, voidHtmlTags } from "html-tags";
// eslint-disable-next-line import/no-extraneous-dependencies
export { default as isHtml } from "is-html";
export { default as sanitizeHtml } from "sanitize-html";
// TODO: Check this tickets
// - https://github.com/codsen/codsen/issues/84
// - https://github.com/codsen/codsen/issues/97
// - https://github.com/codsen/codsen/issues/98
// - https://github.com/codsen/codsen/issues/104
export type {
    Attribute as StripHtmlAttribute,
    CbObj as StripHtmlCbObj,
    Opts as StripHtmlOptions,
    Res as StripHtmlResult,
    Tag as StripHtmlTag,
} from "string-strip-html";
// eslint-disable-next-line import/no-extraneous-dependencies
export { stripHtml, defaults as stripHtmlDefaultOptions } from "string-strip-html";
