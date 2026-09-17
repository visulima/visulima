/**
 * Google result-snippet modelling: truncation limits, the checks that flag a
 * snippet, and the page data a snippet is built from.
 */
import type { MetaTags } from "./meta";

/** Google typically truncates titles at ~60 characters. */
export const TITLE_MAX_CHARS = 60;
/** Meta description is often trimmed at ~158 characters on desktop. */
export const DESCRIPTION_MAX_CHARS = 158;
/** Approximate characters that fit in 3 lines at mobile width. */
export const DESCRIPTION_MOBILE_MAX_CHARS = 120;

const ELLIPSIS = "...";

export interface SerpData {
    description: string;
    favicon: string | null;
    siteName: string;
    title: string;
    url: string;
}

export interface SerpOverflow {
    descriptionOverflow: boolean;
    descriptionOverflowMobile: boolean;
    titleOverflow: boolean;
}

export interface SerpCheck {
    hasIssue: (data: SerpData, overflow: SerpOverflow) => boolean;
    message: string;
}

export interface SerpPreviewConfig {
    extraChecks: SerpCheck[];
    isMobile: boolean;
    label: string;
}

export const COMMON_CHECKS: SerpCheck[] = [
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

export const SERP_PREVIEWS: SerpPreviewConfig[] = [
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

export const truncateToChars = (text: string, maxChars: number): string => {
    if (text.length <= maxChars) {
        return text;
    }

    if (maxChars <= ELLIPSIS.length) {
        return ELLIPSIS;
    }

    return text.slice(0, maxChars - ELLIPSIS.length) + ELLIPSIS;
};

export const getSerpFromMeta = (meta: MetaTags): SerpData => {
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

export const getSerpIssues = (data: SerpData, overflow: SerpOverflow, checks: SerpCheck[]): string[] =>
    checks.filter((c) => c.hasIssue(data, overflow)).map((c) => c.message);
