const SITE_URL = "https://visulima.com";
const SITE_NAME = "Visulima";
const DEFAULT_DESCRIPTION
    = "A collection of high-quality, modular TypeScript packages for Node.js, browsers, and edge runtimes. Build faster with Packem, Pail, Cerebro, and 40+ open-source tools.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

interface SeoOptions {
    canonical?: string;
    description?: string;
    noindex?: boolean;
    ogImage?: string;
    ogType?: "article" | "website";
    path?: string;
    title: string;
}

export function createSeoHead(options: SeoOptions) {
    const { canonical, description = DEFAULT_DESCRIPTION, noindex = false, ogImage = DEFAULT_OG_IMAGE, ogType = "website", path, title } = options;

    const fullTitle = title === SITE_NAME ? title : `${title} - ${SITE_NAME}`;
    const url = canonical ?? (path ? `${SITE_URL}${path}` : SITE_URL);

    const meta: Record<string, string>[] = [
        { content: fullTitle, name: "title" },
        { content: description, name: "description" },
        // Open Graph
        { content: ogType, property: "og:type" },
        { content: url, property: "og:url" },
        { content: fullTitle, property: "og:title" },
        { content: description, property: "og:description" },
        { content: ogImage, property: "og:image" },
        { content: SITE_NAME, property: "og:site_name" },
        // Twitter Card
        { content: "summary_large_image", name: "twitter:card" },
        { content: url, name: "twitter:url" },
        { content: fullTitle, name: "twitter:title" },
        { content: description, name: "twitter:description" },
        { content: ogImage, name: "twitter:image" },
    ];

    if (noindex) {
        meta.push({ content: "noindex, nofollow", name: "robots" });
    }

    const links: Record<string, string>[] = [{ href: url, rel: "canonical" }];

    return { links, meta, title: fullTitle };
}

export function createJsonLd(data: Record<string, unknown>): string {
    return JSON.stringify({ "@context": "https://schema.org", ...data });
}

export { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL };
