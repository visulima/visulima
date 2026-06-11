// Dedicated subpath entry for HTML tag stripping (re-exported from `string-strip-html`).
export type {
    Attribute as StripHtmlAttribute,
    CbObj as StripHtmlCbObj,
    Opts as StripHtmlOptions,
    Res as StripHtmlResult,
    Tag as StripHtmlTag,
} from "string-strip-html";
// eslint-disable-next-line import/no-extraneous-dependencies
export { stripHtml, defaults as stripHtmlDefaultOptions } from "string-strip-html";
