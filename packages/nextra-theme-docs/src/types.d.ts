import type { NextSeoProps } from "next-seo";
import type { ThemeProviderProps } from "next-themes/dist/types";
import type { PageOpts } from "nextra";
import type { FC, ReactNode } from "react";

import type { NavBarProperties } from "./components/navbar";
import type { TOCProperties as TOCPageContentProperties } from "./components/toc/toc-page-content";
import type { TOCProperties as TOCSidebarProperties } from "./components/toc/toc-sidebar";
import type { Item } from "./utils";

export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends FC // do not change properties for optional in FC type
            ? T[P]
            : T[P] extends object
                ? RecursivePartial<T[P]>
                : T[P];
};

export interface DocumentationThemeConfig {
    banner: {
        dismissible: boolean;
        key: string;
        text?: ReactNode | FC;
    };
    chat?: {
        icon: ReactNode | FC;
        link?: string;
    };
    components?: Record<string, FC>;
    darkMode: boolean;
    direction: "ltr" | "rtl";
    docsRepositoryBase: string;
    editLink: {
        component: FC<{
            children: ReactNode;
            className?: string;
            filePath?: string;
        }>;
        text: ReactNode | FC<{ locale: string }>;
    };
    faviconGlyph?: string;
    feedback: {
        content?: ReactNode | FC<{ locale }>;
        link?: (currentTitle: string, currentURL: string) => string;
        labels?: string;
    };
    footer: {
        component?: ReactNode | FC;
        logo?: ReactNode | FC;
        copyright?: ReactNode | FC<{ activeType: string }>;
    };
    getNextSeoProps?: () => NextSeoProps;
    gitTimestamp: ReactNode | FC<{ timestamp: Date }>;
    head: ReactNode | FC;
    i18n: { direction?: string; locale: string; text: string }[];
    logo: ReactNode | FC;
    logoLink?: boolean | string;
    main?: FC<{ children: ReactNode }>;
    navbar: {
        component: ReactNode | FC<NavBarProperties>;
        linkBack?: ReactNode | FC<{ locale: string }>;
    };
    navigation:
    | boolean
    | {
        next: boolean;
        prev: boolean;
    };
    nextThemes: Pick<ThemeProviderProps, "defaultTheme" | "storageKey" | "forcedTheme">;
    notFound: {
        content: ReactNode | FC;
        labels: string;
        pages?: ({ local: string }) => {
            url: string;
            title: string;
            subtitle?: string;
            icon?: ReactNode | FC;
        }[];
    };
    primaryHue:
    | number
    | {
        dark: number;
        light: number;
    };
    project: {
        icon: ReactNode | FC;
        link?: string;
    };
    search: {
        component:
        | ReactNode
        | FC<{
            className?: string;
            directories: Item[];
        }>;
        emptyResult: ReactNode | FC;
        loading: string | (() => string);
        // Can't be React component
        placeholder: string | (({ locale }: { locale: string }) => string);
    };
    serverSideError: {
        content: ReactNode | FC;
        labels: string;
    };
    sidebar: {
        defaultMenuCollapseLevel: number;
        titleComponent: ReactNode | FC<{ title: string; type: string }>;
    };
    tocSidebar: {
        component: ReactNode | FC<TOCSidebarProperties>;
        extraContent?: ReactNode | FC;
        float: boolean;
        title: ReactNode | FC<{ locale: string }>;
    };
    tocContent: {
        component: ReactNode | FC<TOCPageContentProperties>;
        extraContent?: ReactNode | FC;
        float: boolean;
        title: ReactNode | FC<{ locale: string }>;
    };
    hero?: {
        component: ReactNode | FC;
        height: number | string;
    };
}

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
    typesetting: "default" | "article";
};

export type Context = {
    Content: FC;
    pageOpts: PageOpts;
    themeConfig: DocumentationThemeConfig;
};

export type SearchResult = {
    children: ReactNode;
    id: string;
    prefix?: ReactNode;
    route: string;
};
