import type { PageOpts } from "nextra";
import type { ReactNode } from "react";

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

export type ActiveType = string | "doc" | "error" | "hidden" | "page";
