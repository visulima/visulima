export type { JsonLdSchema, JsonLdValidationMessage } from "./json-ld";
export { processJsonLdNode, readJsonLdSchemas, validateJsonLd } from "./json-ld";
export type { MetaTags } from "./meta";
export { readMetaTags } from "./meta";
export type { PlatformConfig } from "./platforms";
export { PLATFORMS } from "./platforms";
export type { SerpCheck, SerpData, SerpOverflow, SerpPreviewConfig } from "./serp";
export {
    COMMON_CHECKS,
    DESCRIPTION_MAX_CHARS,
    DESCRIPTION_MOBILE_MAX_CHARS,
    getSerpFromMeta,
    getSerpIssues,
    SERP_PREVIEWS,
    TITLE_MAX_CHARS,
    truncateToChars,
} from "./serp";
export type { TagDefinition } from "./tag-definitions";
export { TAG_DEFINITIONS } from "./tag-definitions";
