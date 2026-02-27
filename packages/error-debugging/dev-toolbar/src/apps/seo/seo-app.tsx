/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";

// ─── Meta tag parsing ─────────────────────────────────────────────────────────

interface MetaTags {
    title: string;
    description: string;
    canonical: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    ogUrl: string;
    ogType: string;
    twitterCard: string;
    twitterTitle: string;
    twitterDescription: string;
    twitterImage: string;
    twitterSite: string;
}

const readMetaTags = (): MetaTags => {
    const getMeta = (name: string): string =>
        (document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement)?.content ?? "";
    const getOg = (prop: string): string =>
        (document.querySelector(`meta[property="og:${prop}"]`) as HTMLMetaElement)?.content ?? "";
    const getTwitter = (name: string): string =>
        (document.querySelector(`meta[name="twitter:${name}"]`) as HTMLMetaElement)?.content ??
        (document.querySelector(`meta[property="twitter:${name}"]`) as HTMLMetaElement)?.content ?? "";

    return {
        title: document.title ?? "",
        description: getMeta("description"),
        canonical: (document.querySelector('link[rel="canonical"]') as HTMLLinkElement)?.href ?? "",
        ogTitle: getOg("title"),
        ogDescription: getOg("description"),
        ogImage: getOg("image"),
        ogUrl: getOg("url"),
        ogType: getOg("type"),
        twitterCard: getTwitter("card"),
        twitterTitle: getTwitter("title"),
        twitterDescription: getTwitter("description"),
        twitterImage: getTwitter("image"),
        twitterSite: getTwitter("site"),
    };
};

// ─── Social preview cards ─────────────────────────────────────────────────────

interface PlatformConfig {
    id: string;
    name: string;
    accentClass: string;
    titleKey: keyof MetaTags;
    descKey: keyof MetaTags;
    imageKey: keyof MetaTags;
    urlKey: keyof MetaTags;
    requiredKeys: (keyof MetaTags)[];
}

const PLATFORMS: PlatformConfig[] = [
    {
        id: "facebook",
        name: "Facebook",
        accentClass: "border-blue-500/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
    },
    {
        id: "twitter",
        name: "X / Twitter",
        accentClass: "border-foreground/20",
        titleKey: "twitterTitle",
        descKey: "twitterDescription",
        imageKey: "twitterImage",
        urlKey: "ogUrl",
        requiredKeys: ["twitterTitle", "twitterDescription", "twitterImage", "twitterCard"],
    },
    {
        id: "linkedin",
        name: "LinkedIn",
        accentClass: "border-blue-600/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
    },
    {
        id: "discord",
        name: "Discord",
        accentClass: "border-indigo-500/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription"],
    },
    {
        id: "slack",
        name: "Slack",
        accentClass: "border-green-500/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription"],
    },
    {
        id: "mastodon",
        name: "Mastodon",
        accentClass: "border-purple-500/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription"],
    },
    {
        id: "bluesky",
        name: "Bluesky",
        accentClass: "border-sky-500/30",
        titleKey: "ogTitle",
        descKey: "ogDescription",
        imageKey: "ogImage",
        urlKey: "ogUrl",
        requiredKeys: ["ogTitle", "ogDescription"],
    },
];

const SocialPreview = ({ platform, meta }: { platform: PlatformConfig; meta: MetaTags }): ComponentChildren => {
    const title = meta[platform.titleKey] as string || meta.title || "No title";
    const description = meta[platform.descKey] as string || meta.description || "";
    const image = meta[platform.imageKey] as string || "";
    const url = meta[platform.urlKey] as string || meta.canonical || "";
    const missing = platform.requiredKeys.filter((k) => !(meta[k] as string));

    return (
        <div class={cn("border bg-card overflow-hidden", platform.accentClass)}>
            {/* Platform label */}
            <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/50 bg-foreground/[0.02]">
                <span class="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{platform.name}</span>
                {missing.length > 0 && (
                    <span class="text-[0.6rem] px-1.5 py-0.5 bg-warning/10 text-warning border border-warning/20 font-medium">
                        Missing: {missing.join(", ")}
                    </span>
                )}
            </div>

            {/* Preview card */}
            <div class="p-3">
                {/* Image area */}
                <div class="w-full aspect-[1200/630] bg-foreground/[0.06] border border-border/50 mb-2.5 overflow-hidden relative">
                    {image ? (
                        <img
                            alt="OG image preview"
                            class="w-full h-full object-cover"
                            loading="lazy"
                            src={image}
                        />
                    ) : (
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-[0.65rem] text-muted-foreground/40 uppercase tracking-wider">No image</span>
                        </div>
                    )}
                </div>

                {/* Text */}
                {url && (
                    <div class="text-[0.6rem] text-muted-foreground/60 uppercase tracking-wider truncate mb-1">{url}</div>
                )}
                <div class="text-[0.8rem] font-semibold text-foreground line-clamp-1">{title}</div>
                {description && (
                    <div class="text-[0.7rem] text-muted-foreground line-clamp-2 mt-0.5">{description}</div>
                )}
            </div>
        </div>
    );
};

// ─── Meta tags summary table ─────────────────────────────────────────────────

const MetaRow = ({ label, value, required = false }: { label: string; value: string; required?: boolean }): ComponentChildren => (
    <div class="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
        <div class="w-36 shrink-0">
            <span class="text-[0.7rem] font-mono text-muted-foreground">{label}</span>
        </div>
        <div class="flex-1 min-w-0">
            {value ? (
                <span class="text-[0.75rem] text-foreground break-all">{value}</span>
            ) : (
                <span class={cn("text-[0.7rem]", required ? "text-warning" : "text-muted-foreground/40")}>
                    {required ? "⚠ Missing" : "—"}
                </span>
            )}
        </div>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const SeoApp = (_props: AppComponentProps): ComponentChildren => {
    const [meta, setMeta] = useState<MetaTags | null>(null);
    const [activeTab, setActiveTab] = useState<"preview" | "tags">("preview");

    const refresh = (): void => {
        setMeta(readMetaTags());
    };

    useEffect(() => {
        refresh();
    }, []);

    if (!meta) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div class="flex gap-1.5 items-center" aria-hidden="true">
                    {([0, 160, 320] as const).map((delay) => (
                        <span
                            key={delay}
                            class="size-1.5 bg-primary/50 rounded-full animate-pulse"
                            style={{ animationDelay: `${delay}ms` }}
                        />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Reading meta tags…</span>
            </div>
        );
    }

    return (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border shrink-0">
                <div class="flex items-center gap-0">
                    {(["preview", "tags"] as const).map((tab) => (
                        <button
                            key={tab}
                            class={cn(
                                "px-3 py-1.5 text-[0.75rem] font-medium border-0 cursor-pointer transition-colors capitalize",
                                activeTab === tab
                                    ? "text-foreground border-b-2 border-primary bg-transparent"
                                    : "text-muted-foreground bg-transparent hover:text-foreground",
                            )}
                            onClick={() => setActiveTab(tab)}
                            type="button"
                        >
                            {tab === "preview" ? "Social Previews" : "Meta Tags"}
                        </button>
                    ))}
                </div>
                <button
                    class="px-2.5 py-1 text-[0.725rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent transition-colors"
                    onClick={refresh}
                    type="button"
                >
                    Refresh
                </button>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-auto">
                {activeTab === "preview" ? (
                    <div class="p-4 grid grid-cols-2 gap-4">
                        {PLATFORMS.map((platform) => (
                            <SocialPreview key={platform.id} meta={meta} platform={platform} />
                        ))}
                    </div>
                ) : (
                    <div class="p-5">
                        <div class="border border-border bg-card divide-y divide-border/30">
                            <div class="px-4">
                                <MetaRow label="title" value={meta.title} required />
                                <MetaRow label="description" value={meta.description} required />
                                <MetaRow label="canonical" value={meta.canonical} />
                                <MetaRow label="og:title" value={meta.ogTitle} required />
                                <MetaRow label="og:description" value={meta.ogDescription} required />
                                <MetaRow label="og:image" value={meta.ogImage} required />
                                <MetaRow label="og:url" value={meta.ogUrl} />
                                <MetaRow label="og:type" value={meta.ogType} />
                                <MetaRow label="twitter:card" value={meta.twitterCard} required />
                                <MetaRow label="twitter:title" value={meta.twitterTitle} />
                                <MetaRow label="twitter:description" value={meta.twitterDescription} />
                                <MetaRow label="twitter:image" value={meta.twitterImage} />
                                <MetaRow label="twitter:site" value={meta.twitterSite} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeoApp;
