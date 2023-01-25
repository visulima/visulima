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
        text?: FC | ReactNode;
    };
    chat?: {
        icon: FC | ReactNode;
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
        text: string | (({ locale: string }) => string);
    };
    faviconGlyph?: string;
    feedback: {
        content?: FC<{ locale }> | ReactNode;
        link?: (currentTitle: string, currentURL: string) => string;
        labels?: string;
    };
    footer: {
        component?: FC | ReactNode;
        logo?: FC | ReactNode;
        copyright?: FC<{ activeType: string }> | ReactNode;
    };
    getNextSeoProps?: () => NextSeoProps;
    gitTimestamp: FC<{ timestamp: Date }> | ReactNode;
    head: FC | ReactNode;
    i18n: { direction?: string; locale: string; text: string }[];
    logo: FC | ReactNode;
    logoLink?: boolean | string;
    main?: FC<{ children: ReactNode }>;
    navbar: {
        component: FC<NavBarProperties> | ReactNode;
        linkBack?: FC<{ locale: string }> | ReactNode;
    };
    navigation:
    | boolean
    | {
        next: boolean;
        prev: boolean;
    };
    nextThemes: Pick<ThemeProviderProps, "defaultTheme" | "forcedTheme" | "storageKey">;
    notFound: {
        content: FC | ReactNode;
        labels: string;
        pages?: ({ local: string }) => {
            url: string;
            title: string;
            subtitle?: string;
            icon?: FC | ReactNode;
        }[];
    };

    primaryHue:
    | number
    | {
        dark: number;
        light: number;
    };

    project: {
        icon: FC | ReactNode;
        link?: string;
    };

    search: {
        component:
        FC<{
            className?: string;
            directories: Item[];
        }> | ReactNode;
        emptyResult: FC | ReactNode;
        loading: string | (() => string);
        // Can't be React component
        placeholder: string | (({ locale }: { locale: string }) => string);
    };

    serverSideError: {
        content: FC | ReactNode;
        labels: string;
    };

    sidebar: {
        defaultMenuCollapseLevel: number;
        titleComponent: FC<{ title: string; type: string }> | ReactNode;
    };

    tocSidebar: {
        component: FC<TOCSidebarProperties> | ReactNode;
        extraContent?: FC | ReactNode;
        float: boolean;
        title: FC<{ locale: string }> | ReactNode;
    };

    tocContent: {
        component: FC<TOCPageContentProperties> | ReactNode;
        extraContent?: FC | ReactNode;
        float: boolean;
        title: FC<{ locale: string }> | ReactNode;
    };

    hero?: {
        component: FC | ReactNode;
        height: number | string;
    };

    comments?: {
        repository: string;
        repositoryId: string;
        categoryId: string;
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
    typesetting: "article" | "default";
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
