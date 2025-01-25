import type { Meta } from "@content-collections/core";
import type { ReactNode } from "react";

export interface VirtualFile {
    data: unknown;

    /**
     * Relative path
     *
     * @example `docs/page.mdx`
     */
    path: string;

    /**
     * Specified Slugs for page
     */
    slugs?: string[];

    type: "meta" | "page";
}

export interface MetaData {
    defaultOpen?: boolean | undefined;
    description?: string | undefined;
    icon?: string | undefined;
    pages?: string[] | undefined;
    root?: boolean | undefined;
    title?: string | undefined;
}

export interface PageData {
    icon?: string | undefined;
    title: string;
}

export interface SourceConfig {
    metaData: MetaData;
    pageData: PageData;
}

export interface Source<Config extends SourceConfig> {
    /**
     * @internal
     */
    _config?: Config;
    files: VirtualFile[] | ((rootDir: string) => VirtualFile[]);
}

export interface TOCItemType {
    depth: number;
    title: ReactNode;
    url: string;
}

export interface BaseMetaData extends MetaData {
    _meta: Meta;
}

export interface BaseDocsData extends PageData {
    _meta: Meta;
}
