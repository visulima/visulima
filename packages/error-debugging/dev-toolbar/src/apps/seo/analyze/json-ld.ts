/**
 * JSON-LD discovery and per-type validation.
 *
 * Extracted verbatim from the previous single-file panel: it is pure apart
 * from `readJsonLdSchemas`, which reads the document, so the validators are
 * now unit-testable on their own.
 */
export interface JsonLdValidationMessage {
    message: string;
    property: string;
    severity: "error" | "suggestion" | "warning";
}

export interface JsonLdSchema {
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

export const validateJsonLd = (schema: Record<string, unknown>): JsonLdValidationMessage[] => {
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

export const processJsonLdNode = (parsed: Record<string, unknown>, index: number, graphIndex?: number, raw?: string): JsonLdSchema => {
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

export const readJsonLdSchemas = (): JsonLdSchema[] => {
    const scripts = document.querySelectorAll("script[type=\"application/ld+json\"]");
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
