/** Per-platform social card sources and required tags. */
import type { MetaTags } from "./meta";

export interface PlatformConfig {
    accentClass: string;
    descKey: keyof MetaTags;
    imageKey: keyof MetaTags;
    name: string;
    requiredKeys: (keyof MetaTags)[];
    titleKey: keyof MetaTags;
    urlKey: keyof MetaTags;
}

export const PLATFORMS: PlatformConfig[] = [
    {
        accentClass: "border-blue-500/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "Facebook",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-foreground/20",
        descKey: "twitterDescription",
        imageKey: "twitterImage",
        name: "X / Twitter",
        requiredKeys: ["twitterTitle", "twitterDescription", "twitterImage", "twitterCard"],
        titleKey: "twitterTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-blue-600/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "LinkedIn",
        requiredKeys: ["ogTitle", "ogDescription", "ogImage"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-indigo-500/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "Discord",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-green-500/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "Slack",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-purple-500/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "Mastodon",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
    {
        accentClass: "border-sky-500/30",
        descKey: "ogDescription",
        imageKey: "ogImage",
        name: "Bluesky",
        requiredKeys: ["ogTitle", "ogDescription"],
        titleKey: "ogTitle",
        urlKey: "ogUrl",
    },
];
