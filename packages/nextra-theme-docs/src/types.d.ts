import type { PageOpts as BasePageOptions } from "nextra";
import type { Folder,MdxFile } from "nextra";
import type { PageTheme } from "nextra/normalize-pages";
import type { ReactNode } from "react";

import type { DocumentationThemeConfig } from ".";

declare module "nextra/normalize-pages" {
    export interface Item extends MdxFile {
        title: string;
        type: string;
        children?: Item[];
        display?: "children" | "hidden" | "normal";
        withIndexPage?: boolean;
        theme?: PageTheme;
        isUnderCurrentDocsTree?: boolean;
        description?: string;
    }
}

// eslint-disable-next-line unicorn/prevent-abbreviations
export type PageOpts = BasePageOptions & {
    description?: string;
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

// eslint-disable-next-line unicorn/prevent-abbreviations
export type DocsItem = {
    title: string;
    type: string;
    children?: DocsItem[];
    firstChildRoute?: string;
    withIndexPage?: boolean;
    isUnderCurrentDocsTree?: boolean;
} & (MdxFile | Omit<Folder, 'children'>);
