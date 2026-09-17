import type { MetaTags, SerpData, SerpOverflow } from "./analyze";
import {
    COMMON_CHECKS,
    DESCRIPTION_MAX_CHARS,
    DESCRIPTION_MOBILE_MAX_CHARS,
    getSerpFromMeta,
    getSerpIssues,
    PLATFORMS,
    SERP_PREVIEWS,
    TAG_DEFINITIONS,
    TITLE_MAX_CHARS,
    truncateToChars,
} from "./analyze";
import type { SeoElement, SeoSnapshot, SeoSpec } from "./types";

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Collects elements under generated keys, so a builder never has to name them. */
const createBuilder = () => {
    const elements: Record<string, SeoElement> = {};
    let counter = 0;

    const add = (element: SeoElement): string => {
        counter += 1;

        const key = `e${counter}`;

        elements[key] = element;

        return key;
    };

    const pane = (children: string[], variant: "grid" | "pane" = "pane"): string => add({ children, props: { variant }, type: "Stack" });

    return { add, elements, pane };
};

/** The `Meta Tags` tab: one `MetaRow` per tag, grouped by namespace. */
const metaTagGroups = (meta: MetaTags): { rows: { label: string; required?: boolean; value: string }[]; title: string }[] => {
    // Article tags only matter when the page says it is one.
    const showArticle
        = meta.ogType === "article" || Boolean(meta.articleAuthor || meta.articlePublishedTime || meta.articleModifiedTime || meta.articleSection);

    const groups = [
        {
            rows: [
                { label: "title", required: true, value: meta.title },
                { label: "description", required: true, value: meta.description },
                { label: "canonical", value: meta.canonical },
            ],
            title: "Basic",
        },
        {
            rows: [
                { label: "og:title", required: true, value: meta.ogTitle },
                { label: "og:description", required: true, value: meta.ogDescription },
                { label: "og:image", required: true, value: meta.ogImage },
                { label: "og:image:alt", value: meta.ogImageAlt },
                { label: "og:url", value: meta.ogUrl },
                { label: "og:type", value: meta.ogType },
                { label: "og:site_name", value: meta.ogSiteName },
                { label: "og:locale", value: meta.ogLocale },
            ],
            title: "Open Graph",
        },
    ];

    if (showArticle) {
        groups.push({
            rows: [
                { label: "article:author", value: meta.articleAuthor },
                { label: "article:published_time", value: meta.articlePublishedTime },
                { label: "article:modified_time", value: meta.articleModifiedTime },
                { label: "article:section", value: meta.articleSection },
            ],
            title: "Article",
        });
    }

    groups.push({
        rows: [
            { label: "twitter:card", required: true, value: meta.twitterCard },
            { label: "twitter:title", value: meta.twitterTitle },
            { label: "twitter:description", value: meta.twitterDescription },
            { label: "twitter:image", value: meta.twitterImage },
            { label: "twitter:image:alt", value: meta.twitterImageAlt },
            { label: "twitter:site", value: meta.twitterSite },
            { label: "twitter:creator", value: meta.twitterCreator },
        ],
        title: "X / Twitter",
    });

    return groups;
};

/**
 * Builds the SEO panel as a JSON view spec.
 *
 * Pure: every DOM read happens in `analyze/`, so this takes a snapshot and
 * returns data. The two disclosures in the structured-data tab are expressed
 * as state paths (`/expanded/N`, `/raw/N`) driven by the `toggle` action, not
 * as stateful components.
 */

const buildSeoSpec = ({ meta, schemas }: SeoSnapshot): SeoSpec => {
    const { add, elements, pane } = createBuilder();

    const missingRequired = TAG_DEFINITIONS.filter((definition) => definition.priority === "required" && !meta[definition.key]);
    const missingRecommended = TAG_DEFINITIONS.filter((definition) => definition.priority === "recommended" && !meta[definition.key]);
    const missingTotal = missingRequired.length + missingRecommended.length;
    const jsonLdErrors = schemas.filter((schema) => schema.status === "error").length;
    const jsonLdWarnings = schemas.filter((schema) => schema.status === "warning").length;

    // ── Social previews ─────────────────────────────────────────────────────
    const previewPane = pane(
        PLATFORMS.map((platform) =>
            add({
                props: {
                    accentClass: platform.accentClass,
                    description: meta[platform.descKey] || meta.description || "",
                    image: meta[platform.imageKey] || "",
                    missing: platform.requiredKeys.filter((key) => !meta[key]),
                    name: platform.name,
                    title: meta[platform.titleKey] || meta.title || "No title",
                    url: meta[platform.urlKey] || meta.canonical || "",
                },
                type: "SocialCard",
            }),
        ),
        "grid",
    );

    // ── SERP ────────────────────────────────────────────────────────────────
    const serpData: SerpData = getSerpFromMeta(meta);
    const titleText = serpData.title || "No title";
    const descriptionText = serpData.description || "No meta description.";
    const overflow: SerpOverflow = {
        descriptionOverflow: descriptionText.length > DESCRIPTION_MAX_CHARS,
        descriptionOverflowMobile: descriptionText.length > DESCRIPTION_MOBILE_MAX_CHARS,
        titleOverflow: titleText.length > TITLE_MAX_CHARS,
    };

    const serpPane = pane([
        add({
            props: {
                text: "See how your title tag and meta description may look in Google search results. Data is read from the current page.",
            },
            type: "Text",
        }),
        ...SERP_PREVIEWS.map((preview) =>
            add({
                props: {
                    description: truncateToChars(descriptionText, preview.isMobile ? DESCRIPTION_MOBILE_MAX_CHARS : DESCRIPTION_MAX_CHARS),
                    ...(serpData.favicon === null ? {} : { favicon: serpData.favicon }),
                    isMobile: preview.isMobile,
                    issues: getSerpIssues(serpData, overflow, [...COMMON_CHECKS, ...preview.extraChecks]),
                    label: preview.label,
                    siteName: serpData.siteName,
                    title: truncateToChars(titleText, TITLE_MAX_CHARS),
                    url: serpData.url,
                },
                type: "SerpSnippet",
            }),
        ),
    ]);

    // ── Meta tags ───────────────────────────────────────────────────────────
    const tagsPane = pane(
        metaTagGroups(meta).map(({ rows, title }) =>
            add({
                children: rows.map((row) => add({ props: row, type: "MetaRow" })),
                props: { title, variant: "plain" },
                type: "Section",
            }),
        ),
    );

    // ── Missing ─────────────────────────────────────────────────────────────
    const missingGroup = (label: string, tone: "destructive" | "warning", definitions: typeof missingRequired): string[] => {
        if (definitions.length === 0) {
            return [];
        }

        return [
            add({ props: { count: definitions.length, label, tone }, type: "GroupHeading" }),
            add({
                children: definitions.map((definition) =>
                    add({
                        props: {
                            description: definition.description,
                            label: definition.label,
                            priority: definition.priority,
                            snippet: definition.snippet,
                        },
                        type: "TagCard",
                    }),
                ),
                props: { class: "space-y-2" },
                type: "Stack",
            }),
        ];
    };

    const missingPane = pane(
        missingTotal === 0
            ? [
                add({
                    props: {
                        hint: "Your page has all required and recommended meta tags.",
                        icon: "✓",
                        title: "All recommended tags are present",
                        tone: "success",
                    },
                    type: "EmptyState",
                }),
            ]
            : [...missingGroup("Required", "destructive", missingRequired), ...missingGroup("Recommended", "warning", missingRecommended)],
    );

    // ── Structured data ─────────────────────────────────────────────────────
    const schemaCards = schemas.map((schema, index) => {
        const expandedPath = `/expanded/${index}`;
        const rawPath = `/raw/${index}`;
        const label = schema.graphIndex === undefined ? `Script ${schema.index + 1}` : `Script ${schema.index + 1} @graph[${schema.graphIndex}]`;

        const header = add({
            on: { click: { action: "toggle", params: { path: expandedPath } } },
            props: { expanded: { $state: expandedPath }, label, severity: schema.status, title: schema.type },
            type: "DisclosureHeader",
        });

        const body = add({
            children: [
                add({ props: { messages: schema.messages }, type: "MessageList" }),
                add({
                    on: { click: { action: "toggle", params: { path: rawPath } } },
                    props: { expanded: { $state: rawPath }, text: schema.raw },
                    type: "RawToggleRow",
                }),
                add({ props: { code: schema.raw }, type: "CodeBlock", visible: { $state: rawPath } }),
            ],
            props: { class: "border-t border-border" },
            type: "Stack",
            visible: { $state: expandedPath },
        });

        return add({ children: [header, body], props: { variant: "card" }, type: "Section" });
    });

    const jsonLdPane = pane(
        schemas.length === 0
            ? [
                add({
                    props: {
                        hint: "Add a <script type=\"application/ld+json\"> block to help search engines understand your content.",
                        icon: "{}",
                        title: "No structured data found",
                    },
                    type: "EmptyState",
                }),
            ]
            : [
                add({
                    props: {
                        left: `${plural(schemas.length, "schema")} detected`,
                        ...(jsonLdErrors > 0 ? { right: plural(jsonLdErrors, "error") } : {}),
                    },
                    type: "SummaryRow",
                }),
                ...schemaCards,
            ],
    );

    // ── Tabs ────────────────────────────────────────────────────────────────
    const root = add({
        children: [previewPane, serpPane, tagsPane, missingPane, jsonLdPane],
        on: { action: { action: "refresh" } },
        props: {
            actionLabel: "Refresh",
            tabs: [
                { label: "Social Previews", value: "preview" },
                { label: "SERP", value: "serp" },
                { label: "Meta Tags", value: "tags" },
                {
                    ...(missingTotal > 0
                        ? { badge: missingTotal, badgeVariant: missingRequired.length > 0 ? ("destructive" as const) : ("warning" as const) }
                        : {}),
                    label: "Missing",
                    value: "missing",
                },
                {
                    ...(jsonLdErrors > 0 || jsonLdWarnings > 0
                        ? {
                            badge: jsonLdErrors > 0 ? jsonLdErrors : jsonLdWarnings,
                            badgeVariant: jsonLdErrors > 0 ? ("destructive" as const) : ("warning" as const),
                        }
                        : {}),
                    label: "Structured Data",
                    value: "jsonld",
                },
            ],
        },
        type: "TabView",
    });

    return { elements, root };
};

export default buildSeoSpec;
