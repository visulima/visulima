/** The tags the Missing tab reports on, with a copyable snippet each. */
import type { MetaTags } from "./meta";

export interface TagDefinition {
    description: string;
    key: keyof MetaTags;
    label: string;
    priority: "recommended" | "required";
    snippet: string;
}

export const TAG_DEFINITIONS: TagDefinition[] = [
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
        snippet: "<meta property=\"og:title\" content=\"Your Page Title\" />",
    },
    {
        description: "Description shown when sharing on social media (max 200 chars)",
        key: "ogDescription",
        label: "og:description",
        priority: "required",
        snippet: "<meta property=\"og:description\" content=\"Your page description\" />",
    },
    {
        description: "Image shown when sharing (recommended: 1200 × 630 px)",
        key: "ogImage",
        label: "og:image",
        priority: "required",
        snippet: "<meta property=\"og:image\" content=\"https://yoursite.com/og-image.jpg\" />",
    },
    {
        description: "Twitter card format — controls how link previews appear on X / Twitter",
        key: "twitterCard",
        label: "twitter:card",
        priority: "required",
        snippet: "<meta name=\"twitter:card\" content=\"summary_large_image\" />",
    },
    // ── Recommended ───────────────────────────────────────────────────────────
    {
        description: "Meta description used by search engines (max 160 chars)",
        key: "description",
        label: "description",
        priority: "recommended",
        snippet: "<meta name=\"description\" content=\"Your page description\" />",
    },
    {
        description: "Canonical URL to prevent duplicate content issues with search engines",
        key: "canonical",
        label: "canonical",
        priority: "recommended",
        snippet: "<link rel=\"canonical\" href=\"https://yoursite.com/page\" />",
    },
    {
        description: "Canonical page URL for Open Graph — should match the canonical link tag",
        key: "ogUrl",
        label: "og:url",
        priority: "recommended",
        snippet: "<meta property=\"og:url\" content=\"https://yoursite.com/page\" />",
    },
    {
        description: "Type of content: website, article, product, video.movie, etc.",
        key: "ogType",
        label: "og:type",
        priority: "recommended",
        snippet: "<meta property=\"og:type\" content=\"website\" />",
    },
    {
        description: "Your website name — shown for consistent branding on social platforms",
        key: "ogSiteName",
        label: "og:site_name",
        priority: "recommended",
        snippet: "<meta property=\"og:site_name\" content=\"Your Site Name\" />",
    },
    {
        description: "Language and territory of page content (e.g. en_US, de_DE, fr_FR)",
        key: "ogLocale",
        label: "og:locale",
        priority: "recommended",
        snippet: "<meta property=\"og:locale\" content=\"en_US\" />",
    },
    {
        description: "Alt text for the OG image — important for accessibility on social platforms",
        key: "ogImageAlt",
        label: "og:image:alt",
        priority: "recommended",
        snippet: "<meta property=\"og:image:alt\" content=\"Description of the shared image\" />",
    },
    {
        description: "Override title specifically for X / Twitter cards (falls back to og:title)",
        key: "twitterTitle",
        label: "twitter:title",
        priority: "recommended",
        snippet: "<meta name=\"twitter:title\" content=\"Your Page Title\" />",
    },
    {
        description: "Override description for X / Twitter cards (falls back to og:description)",
        key: "twitterDescription",
        label: "twitter:description",
        priority: "recommended",
        snippet: "<meta name=\"twitter:description\" content=\"Your page description\" />",
    },
    {
        description: "Override image for X / Twitter cards (falls back to og:image)",
        key: "twitterImage",
        label: "twitter:image",
        priority: "recommended",
        snippet: "<meta name=\"twitter:image\" content=\"https://yoursite.com/twitter-card.jpg\" />",
    },
    {
        description: "X / Twitter handle of the website owner (e.g. @yourhandle)",
        key: "twitterSite",
        label: "twitter:site",
        priority: "recommended",
        snippet: "<meta name=\"twitter:site\" content=\"@yourhandle\" />",
    },
];
