import type { Display } from "next/dist/compiled/@next/font";
import type { PageOpts as BasePageOptions } from "nextra";
import type { Folder, MdxFile } from "nextra";
import type { PageTheme } from "nextra/normalize-pages";
import type { ReactNode } from "react";

import type { DocumentationThemeConfig } from ".";

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

declare module "nextra/normalize-pages" {
    export interface Item extends MdxFile {
        title: string;
        type: string;
        children?: Item[];
        display?: Display;
        withIndexPage?: boolean;
        theme?: PageTheme;
        isUnderCurrentDocsTree?: boolean;
        description?: string;
    }
}

export type DocsItem = {
    title: string;
    type: string;
    children?: DocsItem[];
    firstChildRoute?: string;
    withIndexPage?: boolean;
    isUnderCurrentDocsTree?: boolean;
} & (FolderWithoutChildren | MdxFile);
