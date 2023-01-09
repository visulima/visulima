import type { PageOpts } from "nextra";
import type { ReactNode } from "react";

export type PageTheme = {
    breadcrumb: boolean;
    collapsed: boolean;
    footer: boolean;
    layout: "default" | "full" | "raw";
    navbar: boolean;
    pagination: boolean;
    sidebar: boolean;
    timestamp: boolean;
    toc: boolean;
    typesetting: "article" | "default";
};

export type Context = {
    pageOpts: PageOpts;
    themeConfig: DocumentationThemeConfig;
};

export type SearchResult = {
    children: ReactNode;
    id: string;
    prefix?: ReactNode;
    route: string;
};

export type ActiveType = string | "doc" | "error" | "hidden" | "page";
