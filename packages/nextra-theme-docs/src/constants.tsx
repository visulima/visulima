import type { PageTheme } from "./types";

export const DEFAULT_LOCALE = "en-US";

export const IS_BROWSER = typeof window !== "undefined";

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
