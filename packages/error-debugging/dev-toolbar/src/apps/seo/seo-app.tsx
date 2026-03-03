/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Badge, Button } from "../../ui";
import cn from "../../utils/cn";

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
    const title = (meta[platform.titleKey] as string) || meta.title || "No title";
    const description = (meta[platform.descKey] as string) || meta.description || "";
    const image = (meta[platform.imageKey] as string) || "";
    const url = (meta[platform.urlKey] as string) || meta.canonical || "";
    const missing = platform.requiredKeys.filter((k) => !(meta[k] as string));

    return (
        <div class={cn("border bg-card overflow-hidden", platform.accentClass)}>
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
                    {image
                        ? (
                        <img alt="OG image preview" class="w-full h-full object-cover" loading="lazy" src={image} />
                        )
                        : (
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
            {value
                ? (
                <span class="text-[0.75rem] text-foreground break-all">{value}</span>
                )
                : (
                <span class={cn("text-[0.7rem]", required ? "text-warning" : "text-muted-foreground/40")}>{required ? "⚠ Missing" : "—"}</span>
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
            .catch(() => { /* ignore */ });
    };

    return (
        <Button
            class={cn("text-[0.6rem] font-mono shrink-0", copied ? "border-success/40 text-success bg-success/8" : "")}
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

// ─── Main component ────────────────────────────────────────────────────────────

type SeoTab = "missing" | "preview" | "tags";

const SeoApp = (_props: AppComponentProps): ComponentChildren => {
    const [meta, setMeta] = useState<MetaTags | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<SeoTab>("preview");

    const refresh = (): void => {
        setMeta(readMetaTags());
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

    const missingRequired = TAG_DEFINITIONS.filter((d) => d.priority === "required" && !(meta[d.key] as string));
    const missingRecommended = TAG_DEFINITIONS.filter((d) => d.priority === "recommended" && !(meta[d.key] as string));
    const missingTotal = missingRequired.length + missingRecommended.length;

    // Show article section only when og:type is "article" or any article tag is set
    const showArticle = meta.ogType === "article" || !!(meta.articleAuthor || meta.articlePublishedTime || meta.articleModifiedTime || meta.articleSection);

    return (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
                <div class="flex items-center gap-0">
                    {(["preview", "tags", "missing"] as const).map((tab) => {
                        const labelMid = tab === "tags" ? "Meta Tags" : "Missing";
                        const label = tab === "preview" ? "Social Previews" : labelMid;
                        const badge = tab === "missing" && missingTotal > 0 ? missingTotal : undefined;

                        return (
                            <button
                                class={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium border-0 cursor-pointer transition-colors capitalize",
                                    activeTab === tab
                                        ? "text-foreground border-b-2 border-primary bg-transparent"
                                        : "text-muted-foreground bg-transparent hover:text-foreground",
                                )}
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                type="button"
                            >
                                {label}
                                {badge !== undefined && (
                                    <Badge class="text-[0.58rem] min-w-[1.1rem] text-center" variant={missingRequired.length > 0 ? "destructive" : "warning"}>
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

                {/* ── Missing Tags ──────────────────────────────────────────── */}
                {activeTab === "missing" && (
                    <div class="p-5 space-y-5">
                        {missingTotal === 0
                            ? (
                            <div class="flex flex-col items-center justify-center py-12 gap-3">
                                <div class="size-10 border border-success/30 bg-success/8 flex items-center justify-center text-success text-lg select-none">
                                    ✓
                                </div>
                                <p class="text-[0.8rem] font-medium text-foreground/70">All recommended tags are present</p>
                                <p class="text-[0.7rem] text-muted-foreground">Your page has all required and recommended meta tags.</p>
                            </div>
                            )
                            : (
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
