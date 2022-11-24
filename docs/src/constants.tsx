import type { PageTheme } from "./types";

export const DEFAULT_LOCALE = "en-US";

export const IS_BROWSER = typeof window !== "undefined";

export const LEGACY_CONFIG_OPTIONS: Record<string, string> = {
    bannerKey: "banner.key",
    bodyExtraContent: "main",
    customSearch: "search.component",
    defaultMenuCollapsed: "sidebar.defaultMenuCollapseLevel",
    feedbackLabels: "feedback.labels",
    feedbackLink: "feedback.content",
    floatTOC: "tocSidebar.float",
    footerEditLink: "editLink.text",
    footerText: "footer.text",
    github: "project.link",
    nextLinks: "navigation.next",
    notFoundLabels: "notFound.labels",
    notFoundLink: "notFound.content",
    prevLinks: "navigation.prev",
    projectChat: "chat",
    projectChatLink: "chat.link",
    projectChatLinkIcon: "chat.icon",
    projectLink: "project.link",
    projectLinkIcon: "project.icon",
    searchPlaceholder: "search.placeholder",
    serverSideErrorLabels: "serverSideError.labels",
    serverSideErrorLink: "serverSideError.content",
    sidebarSubtitle: "sidebar.titleComponent",
    tocExtraContent: "tocSidebar.extraContent",
    unstable_searchResultEmpty: "search.emptyResult",
};

export const DEFAULT_PAGE_THEME: PageTheme = {
    breadcrumb: true,
    collapsed: false,
    footer: true,
    layout: "default",
    navbar: true,
    pagination: true,
    sidebar: true,
    timestamp: true,
    toc: true,
    typesetting: "default",
};
