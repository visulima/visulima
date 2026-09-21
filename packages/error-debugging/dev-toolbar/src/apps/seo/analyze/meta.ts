// Extracted verbatim from the previous single-file panel.
export interface MetaTags {
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

/** Reads the current document's SEO-relevant meta tags. */
export const readMetaTags = (): MetaTags => {
    const getMeta = (name: string): string => (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ?? "";
    const getOg = (prop: string): string => (document.querySelector(`meta[property="og:${prop}"]`) as HTMLMetaElement)?.content ?? "";
    const getTwitter = (name: string): string =>
        (document.querySelector(`meta[name="twitter:${name}"]`) as HTMLMetaElement)?.content
        ?? (document.querySelector(`meta[property="twitter:${name}"]`) as HTMLMetaElement)?.content
        ?? "";
    const getArticle = (prop: string): string => (document.querySelector(`meta[property="article:${prop}"]`) as HTMLMetaElement)?.content ?? "";

    return {
        articleAuthor: getArticle("author"),
        articleModifiedTime: getArticle("modified_time"),
        articlePublishedTime: getArticle("published_time"),
        articleSection: getArticle("section"),
        canonical: (document.querySelector("link[rel=\"canonical\"]") as HTMLLinkElement)?.href ?? "",
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
