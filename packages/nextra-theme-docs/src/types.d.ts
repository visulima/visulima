import type { PageOpts } from "nextra";
import type { ReactNode } from "react";

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
