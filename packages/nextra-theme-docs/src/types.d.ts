import type { PageTheme as BasePageTheme } from "nextra/normalize-pages";
import type { Folder, MdxFile, PageOpts as BasePageOptions } from "nextra/types";
import type { ReactNode } from "react";

import type { DocumentationThemeConfig } from "./theme/theme-schema";

declare module "nextra/normalize-pages" {
    export type PageTheme = BasePageTheme & {
        prose?: boolean;
    };

    export interface Item extends MdxFile {
        children?: Item[];
        description?: string;
        display?: "children" | "hidden" | "normal";
        isUnderCurrentDocsTree?: boolean;
        theme?: PageTheme;
        title: string;
        type: string;
        withIndexPage?: boolean;
    }
}

// eslint-disable-next-line unicorn/prevent-abbreviations
export type PageOpts = BasePageOptions & {
    description?: string;
};

export interface Context {
    pageOpts: PageOpts;
    themeConfig: DocumentationThemeConfig;
}

export interface SearchResult {
    children: ReactNode;
    id: string;
    prefix?: ReactNode;
    route: string;
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ActiveType = string | "doc" | "hidden" | "page";

// eslint-disable-next-line unicorn/prevent-abbreviations
export type DocsItem = {
    children?: DocsItem[];
    firstChildRoute?: string;
    isUnderCurrentDocsTree?: boolean;
    title: string;
    type: string;
    withIndexPage?: boolean;
} & (MdxFile | Omit<Folder, "children">);
