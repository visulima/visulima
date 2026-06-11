/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Badge, Button } from "../../ui";

// ─── Meta tag parsing ─────────────────────────────────────────────────────────

interface MetaTags {
    // Article (og:type = "article")
    articleAuthor: string;
    articleModifiedTime: string;
    articlePublishedTime: string;
    articleSection: string;
    canonical: string;
    description: string;
    ogDescription: string;
    ogImage: string;
    ogImageAlt: string;
    ogLocale: string;
    ogSiteName: string;
    // Open Graph
    ogTitle: string;
    ogType: string;
    ogUrl: string;
    // Basic
    title: string;
    // Twitter / X
    twitterCard: string;
    twitterCreator: string;
    twitterDescription: string;
    twitterImage: string;
    twitterImageAlt: string;
    twitterSite: string;
    twitterTitle: string;
}

const readMetaTags = (): MetaTags => {
    const getMeta = (name: string): string => (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ?? "";
    const getOg = (prop: string): string => (document.querySelector(`meta[property="og:${prop}"]`) as HTMLMetaElement)?.content ?? "";
    const getTwitter = (name: string): string =>
        (document.querySelector(`meta[name="twitter:${name}"]`) as HTMLMetaElement)?.content ??
        (document.querySelector(`meta[property="twitter:${name}"]`) as HTMLMetaElement)?.content ??
        "";
    const getArticle = (prop: string): string => (document.querySelector(`meta[property="article:${prop}"]`) as HTMLMetaElement)?.content ?? "";

    return {
        articleAuthor: getArticle("author"),
        articleModifiedTime: getArticle("modified_time"),
        articlePublishedTime: getArticle("published_time"),
        articleSection: getArticle("section"),
        canonical: (document.querySelector('link[rel="canonical"]') as HTMLLinkElement)?.href ?? "",
        description: getMeta("description"),
        ogDescription: getOg("description"),
        ogImage: getOg("image"),
        ogImageAlt: getOg("image:alt"),
        ogLocale: getOg("locale"),
        ogSiteName: getOg("site_name"),
        ogTitle: getOg("title"),
        ogType: getOg("type"),
        ogUrl: getOg("url"),
        title: document.title ?? "",
        twitterCard: getTwitter("card"),
        twitterCreator: getTwitter("creator"),
        twitterDescription: getTwitter("description"),
        twitterImage: getTwitter("image"),
        twitterImageAlt: getTwitter("image:alt"),
        twitterSite: getTwitter("site"),
        twitterTitle: getTwitter("title"),
    };
};

// ─── JSON-LD parsing & validation ─────────────────────────────────────────────

interface JsonLdValidationMessage {
    message: string;
    property: string;
    severity: "error" | "suggestion" | "warning";
}

interface JsonLdSchema {
    context: string;
    graphIndex?: number;
    index: number;
    messages: JsonLdValidationMessage[];
    parsed: Record<string, unknown>;
    raw: string;
    status: "error" | "ok" | "suggestion" | "warning";
    type: string;
}

// eslint-disable-next-line sonarjs/regex-complexity
const ISO8601_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?)?$/;
const isISO8601 = (value: unknown): boolean => typeof value === "string" && ISO8601_RE.test(value);

const has = (schema: Record<string, unknown>, key: string): boolean => schema[key] !== undefined && schema[key] !== null && schema[key] !== "";

const isNonEmptyArray = (value: unknown): value is any[] => Array.isArray(value) && value.length > 0;

type Validator = (schema: Record<string, unknown>) => JsonLdValidationMessage[];

const validateArticle: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "headline") && !has(schema, "name")) {
        msgs.push({ message: "headline (or name) is required", property: "headline", severity: "error" });
    }

    if (has(schema, "author")) {
        const author = schema["author"] as Record<string, unknown>;

        if (typeof author === "object" && !Array.isArray(author) && !has(author, "name")) {
            msgs.push({ message: "author.name is missing", property: "author.name", severity: "warning" });
        }
    } else {
        msgs.push({ message: "author is required", property: "author", severity: "error" });
    }

    if (!has(schema, "datePublished")) {
        msgs.push({ message: "datePublished is required", property: "datePublished", severity: "error" });
    } else if (!isISO8601(schema["datePublished"])) {
        msgs.push({ message: "datePublished should be ISO 8601 format (e.g. 2024-01-15T09:00:00Z)", property: "datePublished", severity: "warning" });
    }

    if (!has(schema, "image")) {
        msgs.push({ message: "image is recommended for rich results", property: "image", severity: "warning" });
    }

    if (!has(schema, "description")) {
        msgs.push({ message: "description is recommended", property: "description", severity: "suggestion" });
    }

    return msgs;
};

const validateProduct: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    const hasOffers = has(schema, "offers");
    const hasRating = has(schema, "aggregateRating");
    const hasReview = has(schema, "review");

    if (!hasOffers && !hasRating && !hasReview) {
        msgs.push({ message: "At least one of: offers, aggregateRating, or review is required for rich results", property: "offers", severity: "error" });
    }

    if (hasOffers) {
        const offers = Array.isArray(schema["offers"]) ? (schema["offers"] as Record<string, unknown>[])[0] : (schema["offers"] as Record<string, unknown>);

        if (offers && typeof offers === "object") {
            if (!has(offers, "price") && !has(offers, "priceSpecification")) {
                msgs.push({ message: "offers.price is required", property: "offers.price", severity: "error" });
            }

            if (!has(offers, "priceCurrency")) {
                msgs.push({ message: "offers.priceCurrency is required (e.g. 'USD')", property: "offers.priceCurrency", severity: "error" });
            }
        }
    }

    if (hasRating) {
        const rating = schema["aggregateRating"] as Record<string, unknown>;

        if (!has(rating, "ratingValue")) {
            msgs.push({ message: "aggregateRating.ratingValue is required", property: "aggregateRating.ratingValue", severity: "error" });
        }

        if (!has(rating, "reviewCount") && !has(rating, "ratingCount")) {
            msgs.push({ message: "aggregateRating.reviewCount (or ratingCount) is required", property: "aggregateRating.reviewCount", severity: "error" });
        }
    }

    if (!has(schema, "image")) {
        msgs.push({ message: "image is recommended for rich results", property: "image", severity: "suggestion" });
    }

    return msgs;
};

const validateBreadcrumbList: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];
    const items = schema["itemListElement"];

    if (!isNonEmptyArray(items)) {
        msgs.push({ message: "itemListElement array is required", property: "itemListElement", severity: "error" });

        return msgs;
    }

    if (items.length < 2) {
        msgs.push({ message: "itemListElement should have at least 2 items", property: "itemListElement", severity: "warning" });
    }

    items.forEach((item: Record<string, unknown>, i: number) => {
        if (item["position"] !== i + 1) {
            msgs.push({ message: `itemListElement[${i}].position should be ${i + 1}`, property: `itemListElement[${i}].position`, severity: "warning" });
        }

        const name = (item["name"] as string) || (item["item"] as Record<string, unknown>)?.["name"];

        if (!name) {
            msgs.push({ message: `itemListElement[${i}].name is required`, property: `itemListElement[${i}].name`, severity: "error" });
        }
    });

    return msgs;
};

const validateFaqPage: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];
    const items = schema["mainEntity"];

    if (!isNonEmptyArray(items)) {
        msgs.push({ message: "mainEntity array with at least one Question is required", property: "mainEntity", severity: "error" });

        return msgs;
    }

    items.forEach((item: Record<string, unknown>, i: number) => {
        if (!has(item, "name")) {
            msgs.push({ message: `mainEntity[${i}].name (question text) is required`, property: `mainEntity[${i}].name`, severity: "error" });
        }

        const answer = item["acceptedAnswer"] as Record<string, unknown> | undefined;

        if (!answer || !has(answer, "text")) {
            msgs.push({ message: `mainEntity[${i}].acceptedAnswer.text is required`, property: `mainEntity[${i}].acceptedAnswer.text`, severity: "error" });
        }
    });

    return msgs;
};

const validateEvent: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "startDate")) {
        msgs.push({ message: "startDate is required", property: "startDate", severity: "error" });
    } else if (!isISO8601(schema["startDate"])) {
        msgs.push({ message: "startDate should be ISO 8601 format", property: "startDate", severity: "warning" });
    }

    const location = schema["location"] as Record<string, unknown> | undefined;

    if (!location) {
        msgs.push({ message: "location is required", property: "location", severity: "error" });
    } else if (!has(location, "name")) {
        msgs.push({ message: "location.name is required", property: "location.name", severity: "error" });
    }

    if (!has(schema, "description")) {
        msgs.push({ message: "description is recommended", property: "description", severity: "suggestion" });
    }

    return msgs;
};

const validateOrganization: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "url")) {
        msgs.push({ message: "url is recommended", property: "url", severity: "warning" });
    }

    if (!has(schema, "logo")) {
        msgs.push({ message: "logo is recommended for Knowledge Panel eligibility", property: "logo", severity: "suggestion" });
    }

    return msgs;
};

const validatePerson: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "url")) {
        msgs.push({ message: "url is recommended", property: "url", severity: "suggestion" });
    }

    return msgs;
};

const validateRecipe: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "image")) {
        msgs.push({ message: "image is required for rich results", property: "image", severity: "error" });
    }

    if (!has(schema, "recipeIngredient") && !has(schema, "ingredients")) {
        msgs.push({ message: "recipeIngredient is recommended", property: "recipeIngredient", severity: "suggestion" });
    }

    if (!has(schema, "recipeInstructions")) {
        msgs.push({ message: "recipeInstructions is recommended", property: "recipeInstructions", severity: "suggestion" });
    }

    if (!has(schema, "author")) {
        msgs.push({ message: "author is recommended", property: "author", severity: "suggestion" });
    }

    return msgs;
};

const validateWebSiteOrPage: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "url")) {
        msgs.push({ message: "url is recommended", property: "url", severity: "warning" });
    }

    return msgs;
};

const validateVideoObject: Validator = (schema) => {
    const msgs: JsonLdValidationMessage[] = [];

    if (!has(schema, "name")) {
        msgs.push({ message: "name is required", property: "name", severity: "error" });
    }

    if (!has(schema, "description")) {
        msgs.push({ message: "description is required", property: "description", severity: "error" });
    }

    if (!has(schema, "thumbnailUrl")) {
        msgs.push({ message: "thumbnailUrl is required for rich results", property: "thumbnailUrl", severity: "error" });
    }

    if (!has(schema, "uploadDate")) {
        msgs.push({ message: "uploadDate is required", property: "uploadDate", severity: "error" });
    } else if (!isISO8601(schema["uploadDate"])) {
        msgs.push({ message: "uploadDate should be ISO 8601 format", property: "uploadDate", severity: "warning" });
    }

    return msgs;
};

const TYPE_VALIDATORS: Record<string, Validator> = {
    Article: validateArticle,
    BlogPosting: validateArticle,
    BreadcrumbList: validateBreadcrumbList,
    Event: validateEvent,
    EventSeries: validateEvent,
    FAQPage: validateFaqPage,
    LocalBusiness: validateOrganization,
    NewsArticle: validateArticle,
    Organization: validateOrganization,
    Person: validatePerson,
    Product: validateProduct,
    Recipe: validateRecipe,
    VideoObject: validateVideoObject,
    WebPage: validateWebSiteOrPage,
    WebSite: validateWebSiteOrPage,
};

const KNOWN_TYPES = new Set(Object.keys(TYPE_VALIDATORS));

const validateJsonLd = (schema: Record<string, unknown>): JsonLdValidationMessage[] => {
    const msgs: JsonLdValidationMessage[] = [];
    const context = String(schema["@context"] ?? "");
    const type = String(schema["@type"] ?? "");

    if (context) {
        let isSchemaOrgContext = false;

        try {
            const host = new URL(context).hostname.toLowerCase();

            isSchemaOrgContext = host === "schema.org" || host.endsWith(".schema.org");
        } catch {
            // Invalid URL — leave isSchemaOrgContext as false.
        }

        if (!isSchemaOrgContext) {
            msgs.push({ message: "@context should reference schema.org", property: "@context", severity: "warning" });
        }
    } else {
        msgs.push({ message: "@context is missing — should be 'https://schema.org'", property: "@context", severity: "error" });
    }

    if (!type) {
        msgs.push({ message: "@type is required", property: "@type", severity: "error" });

        return msgs;
    }

    if (!KNOWN_TYPES.has(type)) {
        msgs.push({ message: `@type '${type}' is not validated — no known rules for this type`, property: "@type", severity: "suggestion" });
    }

    const validator = TYPE_VALIDATORS[type];

    if (validator) {
        msgs.push(...validator(schema));
    }

    return msgs;
};

const deriveStatus = (messages: JsonLdValidationMessage[]): JsonLdSchema["status"] => {
    if (messages.some((m) => m.severity === "error")) {
        return "error";
    }

    if (messages.some((m) => m.severity === "warning")) {
        return "warning";
    }

    if (messages.some((m) => m.severity === "suggestion")) {
        return "suggestion";
    }

    return "ok";
};

const processJsonLdNode = (parsed: Record<string, unknown>, index: number, graphIndex?: number, raw?: string): JsonLdSchema => {
    const messages = validateJsonLd(parsed);
    const type = String(parsed["@type"] ?? "Unknown");
    const context = String(parsed["@context"] ?? "");

    return {
        context,
        graphIndex,
        index,
        messages,
        parsed,
        raw: raw ?? JSON.stringify(parsed, undefined, 2),
        status: deriveStatus(messages),
        type,
    };
};

const JS_CDATA_START_RE = /^\/\/<!\[CDATA\[/;
const JS_CDATA_END_RE = /\/\/\]\]>$/;
const XML_CDATA_START_RE = /^<!\[CDATA\[/;
const XML_CDATA_END_RE = /\]\]>$/;

const readJsonLdSchemas = (): JsonLdSchema[] => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const schemas: JsonLdSchema[] = [];

    scripts.forEach((script, scriptIndex) => {
        let content = (script.textContent ?? "").trim();

        // Strip JS and XML CDATA wrappers
        content = content.replace(JS_CDATA_START_RE, "").replace(JS_CDATA_END_RE, "");
        content = content.replace(XML_CDATA_START_RE, "").replace(XML_CDATA_END_RE, "");

        try {
            const parsed = JSON.parse(content) as Record<string, unknown>;

            if (isNonEmptyArray(parsed["@graph"])) {
                const parentContext = String(parsed["@context"] ?? "");

                (parsed["@graph"] as Record<string, unknown>[]).forEach((item, graphIndex) => {
                    const enriched = { "@context": item["@context"] ?? parentContext, ...item };

                    schemas.push(processJsonLdNode(enriched, scriptIndex, graphIndex, undefined));
                });
            } else {
                schemas.push(processJsonLdNode(parsed, scriptIndex, undefined, content));
            }
        } catch {
            schemas.push({
                context: "",
                index: scriptIndex,
                messages: [{ message: "Could not parse JSON content", property: "", severity: "error" }],
                parsed: {},
                raw: content,
                status: "error",
                type: "Invalid JSON",
            });
        }
    });

    return schemas;
};

// ─── Tag definitions (for Missing tab) ────────────────────────────────────────

interface TagDefinition {
    description: string;
    key: keyof MetaTags;
    label: string;
    priority: "recommended" | "required";
    snippet: string;
}

const TAG_DEFINITIONS: TagDefinition[] = [
    // ── Required ──────────────────────────────────────────────────────────────
    {
        description: "Page title shown in browser tabs and search engine results",
        key: "title",
        label: "title",
        priority: "required",
        snippet: "<title>Your Page Title</title>",
    },
    {
        description: "Title shown when your page is shared on social media",
        key: "ogTitle",
        label: "og:title",
        priority: "required",
        snippet: '<meta property="og:title" content="Your Page Title" />',
    },
    {
        description: "Description shown when sharing on social media (max 200 chars)",
        key: "ogDescription",
        label: "og:description",
        priority: "required",
        snippet: '<meta property="og:description" content="Your page description" />',
    },
    {
        description: "Image shown when sharing (recommended: 1200 × 630 px)",
        key: "ogImage",
        label: "og:image",
        priority: "required",
        snippet: '<meta property="og:image" content="https://yoursite.com/og-image.jpg" />',
    },
    {
        description: "Twitter card format — controls how link previews appear on X / Twitter",
        key: "twitterCard",
        label: "twitter:card",
        priority: "required",
        snippet: '<meta name="twitter:card" content="summary_large_image" />',
    },
    // ── Recommended ───────────────────────────────────────────────────────────
    {
        description: "Meta description used by search engines (max 160 chars)",
        key: "description",
        label: "description",
        priority: "recommended",
        snippet: '<meta name="description" content="Your page description" />',
    },
    {
        description: "Canonical URL to prevent duplicate content issues with search engines",
        key: "canonical",
        label: "canonical",
        priority: "recommended",
        snippet: '<link rel="canonical" href="https://yoursite.com/page" />',
    },
    {
        description: "Canonical page URL for Open Graph — should match the canonical link tag",
        key: "ogUrl",
        label: "og:url",
        priority: "recommended",
        snippet: '<meta property="og:url" content="https://yoursite.com/page" />',
    },
    {
        description: "Type of content: website, article, product, video.movie, etc.",
        key: "ogType",
        label: "og:type",
        priority: "recommended",
        snippet: '<meta property="og:type" content="website" />',
    },
    {
        description: "Your website name — shown for consistent branding on social platforms",
        key: "ogSiteName",
        label: "og:site_name",
        priority: "recommended",
        snippet: '<meta property="og:site_name" content="Your Site Name" />',
    },
    {
        description: "Language and territory of page content (e.g. en_US, de_DE, fr_FR)",
        key: "ogLocale",
        label: "og:locale",
        priority: "recommended",
        snippet: '<meta property="og:locale" content="en_US" />',
    },
    {
        description: "Alt text for the OG image — important for accessibility on social platforms",
        key: "ogImageAlt",
        label: "og:image:alt",
        priority: "recommended",
        snippet: '<meta property="og:image:alt" content="Description of the shared image" />',
    },
    {
        description: "Override title specifically for X / Twitter cards (falls back to og:title)",
        key: "twitterTitle",
        label: "twitter:title",
        priority: "recommended",
        snippet: '<meta name="twitter:title" content="Your Page Title" />',
    },
    {
        description: "Override description for X / Twitter cards (falls back to og:description)",
        key: "twitterDescription",
        label: "twitter:description",
        priority: "recommended",
        snippet: '<meta name="twitter:description" content="Your page description" />',
    },
    {
        description: "Override image for X / Twitter cards (falls back to og:image)",
        key: "twitterImage",
        label: "twitter:image",
        priority: "recommended",
        snippet: '<meta name="twitter:image" content="https://yoursite.com/twitter-card.jpg" />',
    },
    {
        description: "X / Twitter handle of the website owner (e.g. @yourhandle)",
        key: "twitterSite",
        label: "twitter:site",
        priority: "recommended",
        snippet: '<meta name="twitter:site" content="@yourhandle" />',
    },
];

// ─── Social preview platforms ─────────────────────────────────────────────────

interface PlatformConfig {
    accentClass: string;
    descKey: keyof MetaTags;
    id: string;
    imageKey: keyof MetaTags;
    name: string;
    requiredKeys: (keyof MetaTags)[];
    titleKey: keyof MetaTags;
    urlKey: keyof MetaTags;
}

const PLATFORMS: PlatformConfig[] = [
    {
        accentClass: "border-blue-500/30",
        descKey: "ogDescription",
        id: "facebook",
        imageKey: "ogImage",
        name: "Facebook",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-foreground/20",
        descKey: "twitterDescription",
        id: "twitter",
        imageKey: "twitterImage",
        name: "X / Twitter",
        requiredKeys: ["twitterTitle", "twitterDescription", "twitterImage", "twitterCard"],
        titleKey: "twitterTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-blue-600/30",
        descKey: "ogDescription",
        id: "linkedin",
        imageKey: "ogImage",
        name: "LinkedIn",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-indigo-500/30",
        descKey: "ogDescription",
        id: "discord",
        imageKey: "ogImage",
        name: "Discord",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-green-500/30",
        descKey: "ogDescription",
        id: "slack",
        imageKey: "ogImage",
        name: "Slack",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-purple-500/30",
        descKey: "ogDescription",
        id: "mastodon",
        imageKey: "ogImage",
        name: "Mastodon",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-sky-500/30",
        descKey: "ogDescription",
        id: "bluesky",
        imageKey: "ogImage",
        name: "Bluesky",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
];

const SocialPreview = ({ meta, platform }: { meta: MetaTags; platform: PlatformConfig }): ComponentChildren => {
    const title = meta[platform.titleKey] || meta.title || "No title";
    const description = meta[platform.descKey] || meta.description || "";
    const image = meta[platform.imageKey] || "";
    const url = meta[platform.urlKey] || meta.canonical || "";
    const missing = platform.requiredKeys.filter((k) => !meta[k]);

    return (
        <div class={clsx("border bg-card overflow-hidden", platform.accentClass)}>
            <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-foreground/2">
                <span class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{platform.name}</span>
                {missing.length > 0 && (
                    <span class="text-[0.6rem] px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 font-medium">
                        Missing: {missing.join(", ")}
                    </span>
                )}
            </div>
            <div class="p-3">
                <div class="w-full aspect-[1200/630] bg-foreground/6 border border-border/50 mb-2.5 overflow-hidden relative">
                    {image ? (
                        <img alt="OG image preview" class="w-full h-full object-cover" loading="lazy" src={image} />
                    ) : (
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-[0.65rem] text-muted-foreground/40 uppercase tracking-wider">No image</span>
                        </div>
                    )}
                </div>
                {url && <div class="text-[0.6rem] text-muted-foreground/60 uppercase tracking-wider truncate mb-1">{url}</div>}
                <div class="text-[0.8rem] font-semibold text-foreground line-clamp-1">{title}</div>
                {description && <div class="text-[0.7rem] text-muted-foreground line-clamp-2 mt-0.5">{description}</div>}
            </div>
        </div>
    );
};

// ─── Meta tags table row ──────────────────────────────────────────────────────

const MetaRow = ({ label, required = false, value }: { label: string; required?: boolean; value: string }): ComponentChildren => (
    <div class="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
        <div class="w-44 shrink-0">
            <span class="text-[0.7rem] font-mono text-muted-foreground">{label}</span>
        </div>
        <div class="flex-1 min-w-0">
            {value ? (
                <span class="text-[0.75rem] text-foreground break-all">{value}</span>
            ) : (
                <span class={clsx("text-[0.7rem]", required ? "text-warning" : "text-muted-foreground/40")}>{required ? "⚠ Missing" : "—"}</span>
            )}
        </div>
    </div>
);

// ─── Section heading ──────────────────────────────────────────────────────────

const SectionHeading = ({ children }: { children: ComponentChildren }): ComponentChildren => (
    <p class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-2">
        <span class="text-primary/50">// </span>
        {children}
    </p>
);

// ─── Copy button ──────────────────────────────────────────────────────────────

const CopyButton = ({ text }: { text: string }): ComponentChildren => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleCopy = (): void => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                setCopied(true);

                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }

                timerRef.current = setTimeout(setCopied, 2000, false);

                return undefined;
            })
            .catch(() => {
                /* ignore */
            });
    };

    return (
        <Button
            class={clsx("text-[0.6rem] font-mono shrink-0", copied ? "border-success/40 text-success bg-success/8" : "")}
            onClick={handleCopy}
            size="sm"
            variant="outline"
        >
            {copied ? "Copied!" : "Copy"}
        </Button>
    );
};

// ─── Missing tag card ─────────────────────────────────────────────────────────

const MissingTagCard = ({ def }: { def: TagDefinition }): ComponentChildren => (
    <div class="border border-border/60 bg-card p-3 space-y-2">
        <div class="flex items-start justify-between gap-3">
            <code class="text-[0.7rem] font-mono font-bold text-foreground">{def.label}</code>
            <Badge class="text-[0.58rem] uppercase tracking-wide shrink-0" variant={def.priority === "required" ? "destructive" : "warning"}>
                {def.priority}
            </Badge>
        </div>
        <p class="text-[0.7rem] text-muted-foreground leading-relaxed">{def.description}</p>
        <div class="flex items-center gap-2">
            <code class="flex-1 min-w-0 text-[0.65rem] font-mono text-muted-foreground bg-foreground/4 border border-border/40 px-2 py-1 overflow-x-auto whitespace-nowrap block">
                {def.snippet}
            </code>
            <CopyButton text={def.snippet} />
        </div>
    </div>
);

// ─── JSON-LD schema card ──────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
    error: { color: "text-destructive", icon: "✖", label: "Error" },
    ok: { color: "text-success", icon: "✔", label: "OK" },
    suggestion: { color: "text-primary", icon: "ℹ", label: "Info" },
    warning: { color: "text-warning", icon: "⚠", label: "Warning" },
} as const;

const STATUS_BADGE_VARIANT: Record<JsonLdSchema["status"], "destructive" | "outline" | "success" | "warning"> = {
    error: "destructive",
    ok: "success",
    suggestion: "outline",
    warning: "warning",
};

const SchemaCard = ({ schema }: { schema: JsonLdSchema }): ComponentChildren => {
    const [open, setOpen] = useState(false);
    const [showRaw, setShowRaw] = useState(false);
    const cfg = SEVERITY_CONFIG[schema.status];
    const label = schema.graphIndex === undefined ? `Script ${schema.index + 1}` : `Script ${schema.index + 1} @graph[${schema.graphIndex}]`;

    return (
        <div class="border border-border bg-card overflow-hidden">
            <button
                class="w-full flex items-center justify-between gap-3 px-4 py-3 bg-transparent border-0 cursor-pointer text-left hover:bg-foreground/3 transition-colors"
                onClick={() => {
                    setOpen((v) => !v);
                }}
                type="button"
            >
                <div class="flex items-center gap-2 min-w-0">
                    <span class={clsx("text-base shrink-0 leading-none", cfg.color)}>{cfg.icon}</span>
                    <span class="text-[0.7rem] text-muted-foreground font-mono shrink-0">{label}</span>
                    <code class="text-[0.75rem] font-mono font-semibold text-foreground truncate">{schema.type}</code>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <Badge variant={STATUS_BADGE_VARIANT[schema.status]}>{cfg.label}</Badge>
                    <span class={clsx("text-muted-foreground text-[0.65rem] transition-transform duration-150", open ? "rotate-90" : "")}>▶</span>
                </div>
            </button>

            {open && (
                <div class="border-t border-border">
                    {/* Validation messages */}
                    {schema.messages.length > 0 ? (
                        <div class="px-4 py-3 space-y-1.5">
                            {schema.messages.map((message, i) => {
                                const messageCfg = SEVERITY_CONFIG[message.severity];

                                return (
                                    <div class="flex items-start gap-2 text-[0.72rem]" key={i}>
                                        <span class={clsx("shrink-0 leading-none mt-px", messageCfg.color)}>{messageCfg.icon}</span>
                                        <div class="min-w-0">
                                            {message.property && <code class="text-[0.65rem] font-mono text-muted-foreground mr-1.5">{message.property}:</code>}
                                            <span class="text-foreground/80">{message.message}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div class="px-4 py-3 flex items-center gap-2 text-[0.72rem] text-success">
                            <span>✔</span>
                            <span>No issues found</span>
                        </div>
                    )}

                    {/* Raw JSON toggle */}
                    <div class="border-t border-border/50 px-4 py-2 flex items-center justify-between">
                        <button
                            class="text-[0.65rem] text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 cursor-pointer p-0"
                            onClick={() => {
                                setShowRaw((v) => !v);
                            }}
                            type="button"
                        >
                            {showRaw ? "Hide" : "Show"} raw JSON
                        </button>
                        <CopyButton text={schema.raw} />
                    </div>

                    {showRaw && (
                        <pre class="text-[0.65rem] font-mono leading-relaxed bg-foreground/3 border-t border-border/50 px-4 py-3 overflow-x-auto max-h-60 text-muted-foreground whitespace-pre-wrap break-all m-0">
                            {schema.raw}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── SERP preview ────────────────────────────────────────────────────────────

/** Google typically truncates titles at ~60 characters. */
const TITLE_MAX_CHARS = 60;
/** Meta description is often trimmed at ~158 characters on desktop. */
const DESCRIPTION_MAX_CHARS = 158;
/** Approximate characters that fit in 3 lines at mobile width. */
const DESCRIPTION_MOBILE_MAX_CHARS = 120;

const ELLIPSIS = "...";

interface SerpData {
    description: string;
    favicon: string | null;
    siteName: string;
    title: string;
    url: string;
}

interface SerpOverflow {
    descriptionOverflow: boolean;
    descriptionOverflowMobile: boolean;
    titleOverflow: boolean;
}

interface SerpCheck {
    hasIssue: (data: SerpData, overflow: SerpOverflow) => boolean;
    message: string;
}

interface SerpPreviewConfig {
    extraChecks: SerpCheck[];
    isMobile: boolean;
    label: string;
}

const COMMON_CHECKS: SerpCheck[] = [
    {
        hasIssue: (data) => !data.favicon,
        message: "No favicon or icon set on the page.",
    },
    {
        hasIssue: (data) => !data.title.trim(),
        message: "No title tag set on the page.",
    },
    {
        hasIssue: (data) => !data.description.trim(),
        message: "No meta description set on the page.",
    },
    {
        hasIssue: (_, overflow) => overflow.titleOverflow,
        message: "The title exceeds ~60 characters and may be truncated in search results.",
    },
];

const SERP_PREVIEWS: SerpPreviewConfig[] = [
    {
        extraChecks: [
            {
                hasIssue: (_, overflow) => overflow.descriptionOverflow,
                message: "The meta description exceeds ~158 characters and may be trimmed on desktop.",
            },
        ],
        isMobile: false,
        label: "Desktop preview",
    },
    {
        extraChecks: [
            {
                hasIssue: (_, overflow) => overflow.descriptionOverflowMobile,
                message: "Description exceeds the 3-line limit for mobile view (~120 characters).",
            },
        ],
        isMobile: true,
        label: "Mobile preview",
    },
];

const truncateToChars = (text: string, maxChars: number): string => {
    if (text.length <= maxChars) {
        return text;
    }

    if (maxChars <= ELLIPSIS.length) {
        return ELLIPSIS;
    }

    return text.slice(0, maxChars - ELLIPSIS.length) + ELLIPSIS;
};

const getSerpFromMeta = (meta: MetaTags): SerpData => {
    const url = globalThis.window === undefined ? "" : globalThis.location.href;
    const siteName = meta.ogSiteName || (globalThis.window === undefined ? "" : globalThis.location.hostname.replace(/^www\./, ""));

    const linkTags = [...document.head.querySelectorAll("link")];
    const iconLink = linkTags.find((l) => l.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("icon"));
    let favicon: string | null = iconLink?.getAttribute("href") || null;

    if (favicon && globalThis.window !== undefined) {
        try {
            favicon = new URL(favicon, url).href;
        } catch {
            favicon = null;
        }
    }

    return {
        description: meta.description,
        favicon,
        siteName,
        title: meta.title,
        url,
    };
};

const getSerpIssues = (data: SerpData, overflow: SerpOverflow, checks: SerpCheck[]): string[] =>
    checks.filter((c) => c.hasIssue(data, overflow)).map((c) => c.message);

const SerpSnippetPreview = ({
    data,
    displayDescription,
    displayTitle,
    isMobile,
    issues,
    label,
}: {
    data: SerpData;
    displayDescription: string;
    displayTitle: string;
    isMobile: boolean;
    issues: string[];
    label: string;
}): ComponentChildren => (
    <div class="border border-border bg-card p-4 mb-4">
        <p class="text-[0.7rem] font-semibold text-muted-foreground mb-3">{label}</p>

        <div class={clsx("border border-border/50 bg-background p-4 font-sans", isMobile ? "max-w-[380px]" : "max-w-[600px]")}>
            {/* Top row: favicon + site info */}
            <div class="flex items-center gap-3 mb-2">
                {data.favicon ? (
                    <img alt="favicon" class="size-7 rounded-full shrink-0 object-contain" src={data.favicon} />
                ) : (
                    <div class="size-7 rounded-full shrink-0 bg-foreground/10 flex items-center justify-center" />
                )}
                <div class="flex flex-col min-w-0">
                    <span class="text-[0.875rem] text-foreground leading-snug">{data.siteName || data.url}</span>
                    <span class="text-[0.75rem] text-muted-foreground leading-snug truncate">{data.url}</span>
                </div>
            </div>

            {/* Title */}
            <p class="text-[1.25rem] font-normal leading-snug mb-1 m-0" style={{ color: "var(--color-info, #1a0dab)" }}>
                {displayTitle || "No title"}
            </p>

            {/* Description */}
            <p class={clsx("text-[0.875rem] text-muted-foreground leading-relaxed m-0", isMobile && "line-clamp-3")}>
                {displayDescription || "No meta description."}
            </p>
        </div>

        {/* Issues */}
        {issues.length > 0 && (
            <div class="mt-3">
                <p class="text-[0.7rem] font-semibold text-destructive mb-1">Issues:</p>
                <ul class="m-0 pl-5 list-disc">
                    {issues.map((issue, i) => (
                        <li class="text-[0.75rem] text-destructive/80 mt-0.5" key={i}>
                            {issue}
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
);

const SerpPreview = ({ meta }: { meta: MetaTags }): ComponentChildren => {
    const data = getSerpFromMeta(meta);
    const titleText = data.title || "No title";
    const descText = data.description || "No meta description.";
    const displayTitle = truncateToChars(titleText, TITLE_MAX_CHARS);
    const displayDescription = truncateToChars(descText, DESCRIPTION_MAX_CHARS);
    const overflow: SerpOverflow = {
        descriptionOverflow: descText.length > DESCRIPTION_MAX_CHARS,
        descriptionOverflowMobile: descText.length > DESCRIPTION_MOBILE_MAX_CHARS,
        titleOverflow: titleText.length > TITLE_MAX_CHARS,
    };

    return (
        <div>
            <p class="text-[0.7rem] text-muted-foreground mb-3 leading-relaxed">
                See how your title tag and meta description may look in Google search results. Data is read from the current page.
            </p>
            {SERP_PREVIEWS.map((preview) => {
                const issues = getSerpIssues(data, overflow, [...COMMON_CHECKS, ...preview.extraChecks]);

                return (
                    <SerpSnippetPreview
                        data={data}
                        displayDescription={preview.isMobile ? truncateToChars(descText, DESCRIPTION_MOBILE_MAX_CHARS) : displayDescription}
                        displayTitle={displayTitle}
                        isMobile={preview.isMobile}
                        issues={issues}
                        key={preview.label}
                        label={preview.label}
                    />
                );
            })}
        </div>
    );
};

// ─── Main component ────────────────────────────────────────────────────────────

type SeoTab = "jsonld" | "missing" | "preview" | "serp" | "tags";

const SeoApp = (_props: AppComponentProps): ComponentChildren => {
    const [meta, setMeta] = useState<MetaTags | undefined>(undefined);
    const [schemas, setSchemas] = useState<JsonLdSchema[]>([]);
    const [activeTab, setActiveTab] = useState<SeoTab>("preview");

    const refresh = (): void => {
        setMeta(readMetaTags());
        setSchemas(readJsonLdSchemas());
    };

    useEffect(() => {
        refresh();
    }, []);

    if (!meta) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div aria-hidden="true" class="flex gap-1.5 items-center">
                    {([0, 160, 320] as const).map((delay) => (
                        <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Reading meta tags…</span>
            </div>
        );
    }

    const missingRequired = TAG_DEFINITIONS.filter((d) => d.priority === "required" && !meta[d.key]);
    const missingRecommended = TAG_DEFINITIONS.filter((d) => d.priority === "recommended" && !meta[d.key]);
    const missingTotal = missingRequired.length + missingRecommended.length;
    const jsonLdErrors = schemas.filter((s) => s.status === "error").length;
    const jsonLdWarnings = schemas.filter((s) => s.status === "warning").length;
    let jsonLdBadge: number | undefined;

    if (jsonLdErrors > 0) {
        jsonLdBadge = jsonLdErrors;
    } else if (jsonLdWarnings > 0) {
        jsonLdBadge = jsonLdWarnings;
    }

    // Show article section only when og:type is "article" or any article tag is set
    const showArticle = meta.ogType === "article" || !!(meta.articleAuthor || meta.articlePublishedTime || meta.articleModifiedTime || meta.articleSection);

    return (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
                <div class="flex items-center gap-0">
                    {(["preview", "serp", "tags", "missing", "jsonld"] as const).map((tab) => {
                        const LABELS: Record<SeoTab, string> = {
                            jsonld: "Structured Data",
                            missing: "Missing",
                            preview: "Social Previews",
                            serp: "SERP",
                            tags: "Meta Tags",
                        };
                        const label = LABELS[tab];
                        let badge: number | undefined;

                        if (tab === "missing" && missingTotal > 0) {
                            badge = missingTotal;
                        } else if (tab === "jsonld" && jsonLdBadge !== undefined) {
                            badge = jsonLdBadge;
                        }

                        let badgeVariant: "destructive" | "warning";

                        if (tab === "missing") {
                            badgeVariant = missingRequired.length > 0 ? "destructive" : "warning";
                        } else {
                            badgeVariant = jsonLdErrors > 0 ? "destructive" : "warning";
                        }

                        return (
                            <button
                                class={clsx(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium border-0 cursor-pointer transition-colors capitalize",
                                    activeTab === tab
                                        ? "text-foreground border-b-2 border-primary bg-transparent"
                                        : "text-muted-foreground bg-transparent hover:text-foreground",
                                )}
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab);
                                }}
                                type="button"
                            >
                                {label}
                                {badge !== undefined && (
                                    <Badge class="text-[0.58rem] min-w-[1.1rem] text-center" variant={badgeVariant}>
                                        {badge}
                                    </Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
                <Button onClick={refresh} size="sm" variant="outline">
                    Refresh
                </Button>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-auto">
                {/* ── Social Previews ──────────────────────────────────────── */}
                {activeTab === "preview" && (
                    <div class="p-4 grid grid-cols-2 gap-4">
                        {PLATFORMS.map((platform) => (
                            <SocialPreview key={platform.id} meta={meta} platform={platform} />
                        ))}
                    </div>
                )}

                {/* ── SERP Preview ─────────────────────────────────────────── */}
                {activeTab === "serp" && (
                    <div class="p-4">
                        <SerpPreview meta={meta} />
                    </div>
                )}

                {/* ── Meta Tags ─────────────────────────────────────────────── */}
                {activeTab === "tags" && (
                    <div class="p-5 space-y-5">
                        <div>
                            <SectionHeading>Basic</SectionHeading>
                            <div class="border border-border bg-card">
                                <div class="px-4">
                                    <MetaRow label="title" required value={meta.title} />
                                    <MetaRow label="description" required value={meta.description} />
                                    <MetaRow label="canonical" value={meta.canonical} />
                                </div>
                            </div>
                        </div>

                        <div>
                            <SectionHeading>Open Graph</SectionHeading>
                            <div class="border border-border bg-card">
                                <div class="px-4">
                                    <MetaRow label="og:title" required value={meta.ogTitle} />
                                    <MetaRow label="og:description" required value={meta.ogDescription} />
                                    <MetaRow label="og:image" required value={meta.ogImage} />
                                    <MetaRow label="og:image:alt" value={meta.ogImageAlt} />
                                    <MetaRow label="og:url" value={meta.ogUrl} />
                                    <MetaRow label="og:type" value={meta.ogType} />
                                    <MetaRow label="og:site_name" value={meta.ogSiteName} />
                                    <MetaRow label="og:locale" value={meta.ogLocale} />
                                </div>
                            </div>
                        </div>

                        {showArticle && (
                            <div>
                                <SectionHeading>Article</SectionHeading>
                                <div class="border border-border bg-card">
                                    <div class="px-4">
                                        <MetaRow label="article:author" value={meta.articleAuthor} />
                                        <MetaRow label="article:published_time" value={meta.articlePublishedTime} />
                                        <MetaRow label="article:modified_time" value={meta.articleModifiedTime} />
                                        <MetaRow label="article:section" value={meta.articleSection} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <SectionHeading>X / Twitter</SectionHeading>
                            <div class="border border-border bg-card">
                                <div class="px-4">
                                    <MetaRow label="twitter:card" required value={meta.twitterCard} />
                                    <MetaRow label="twitter:title" value={meta.twitterTitle} />
                                    <MetaRow label="twitter:description" value={meta.twitterDescription} />
                                    <MetaRow label="twitter:image" value={meta.twitterImage} />
                                    <MetaRow label="twitter:image:alt" value={meta.twitterImageAlt} />
                                    <MetaRow label="twitter:site" value={meta.twitterSite} />
                                    <MetaRow label="twitter:creator" value={meta.twitterCreator} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Structured Data ──────────────────────────────────────── */}
                {activeTab === "jsonld" && (
                    <div class="p-5 space-y-3">
                        {schemas.length === 0 ? (
                            <div class="flex flex-col items-center justify-center py-12 gap-3">
                                <div class="size-10 border border-border flex items-center justify-center text-muted-foreground/40 text-lg select-none">
                                    {"{}"}
                                </div>
                                <p class="text-[0.8rem] font-medium text-foreground/70">No structured data found</p>
                                <p class="text-[0.7rem] text-muted-foreground text-center max-w-xs leading-relaxed">
                                    {}
                                    Add a <code class="font-mono bg-foreground/6 px-1">{'<script type="application/ld+json">'}</code> block to help search
                                    engines understand your content.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div class="flex items-center justify-between mb-1">
                                    <p class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                        {schemas.length} schema{schemas.length === 1 ? "" : "s"} detected
                                    </p>
                                    {jsonLdErrors > 0 && (
                                        <span class="text-[0.65rem] text-destructive font-medium">
                                            {jsonLdErrors} error{jsonLdErrors === 1 ? "" : "s"}
                                        </span>
                                    )}
                                </div>
                                {schemas.map((schema, i) => (
                                    <SchemaCard key={i} schema={schema} />
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* ── Missing Tags ──────────────────────────────────────────── */}
                {activeTab === "missing" && (
                    <div class="p-5 space-y-5">
                        {missingTotal === 0 ? (
                            <div class="flex flex-col items-center justify-center py-12 gap-3">
                                <div class="size-10 border border-success/30 bg-success/8 flex items-center justify-center text-success text-lg select-none">
                                    ✓
                                </div>
                                <p class="text-[0.8rem] font-medium text-foreground/70">All recommended tags are present</p>
                                <p class="text-[0.7rem] text-muted-foreground">Your page has all required and recommended meta tags.</p>
                            </div>
                        ) : (
                            <>
                                {missingRequired.length > 0 && (
                                    <div>
                                        <p class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-destructive/80 mb-2 flex items-center gap-1.5">
                                            <span>Required</span>
                                            <span class="bg-destructive/10 border border-destructive/25 text-destructive px-1 font-bold">
                                                {missingRequired.length}
                                            </span>
                                        </p>
                                        <div class="space-y-2">
                                            {missingRequired.map((definition) => (
                                                <MissingTagCard def={definition} key={definition.key} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {missingRecommended.length > 0 && (
                                    <div>
                                        <p class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-warning/80 mb-2 flex items-center gap-1.5">
                                            <span>Recommended</span>
                                            <span class="bg-warning/10 border border-warning/25 text-warning px-1 font-bold">{missingRecommended.length}</span>
                                        </p>
                                        <div class="space-y-2">
                                            {missingRecommended.map((definition) => (
                                                <MissingTagCard def={definition} key={definition.key} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeoApp;
