// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This file is copied from the Nextra repository and is not type safe.
import cn from "clsx";
import FlexSearch from "flexsearch";
import { useRouter } from "next/router";
import type { SearchData } from "nextra/types";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";

import { DEFAULT_LOCALE } from "../constants/base";
import type { SearchResult } from "../types";
import HighlightMatches from "./highlight-matches";
import Search from "./search";

type SectionIndex = FlexSearch.Document<
    {
        content: string;
        display?: string;
        id: string;
        pageId: string;
        title: string;
        url: string;
    },
    ["title", "content", "url", "display"]
>;

type PageIndex = FlexSearch.Document<
    {
        content: string;
        id: number;
        title: string;
    },
    ["title"]
>;

interface Result {
    _page_rk: number;
    _section_rk: number;
    children: ReactNode;
    prefix: ReactNode;
    route: string;
}

// This can be global for better caching.
const indexes: Record<string, [PageIndex, SectionIndex]> = {};

// Caches promises that load the index
const loadIndexesPromises = new Map<string, Promise<void>>();

/* eslint-disable no-underscore-dangle */
const loadIndexesImpl = async (basePath: string, locale: string): Promise<void> => {
    // eslint-disable-next-line compat/compat
    const response = await fetch(`${basePath}/_next/static/chunks/nextra-data-${locale}.json`);
    const searchData = (await response.json()) as SearchData;

    // eslint-disable-next-line import/no-named-as-default-member
    const pageIndex: PageIndex = new FlexSearch.Document({
        cache: 100,
        context: {
            bidirectional: true,
            depth: 2,
            resolution: 9,
        },
        document: {
            id: "id",
            index: "content",
            store: ["title"],
        },
        tokenize: "full",
    });

    // eslint-disable-next-line import/no-named-as-default-member
    const sectionIndex: SectionIndex = new FlexSearch.Document({
        cache: 100,
        context: {
            bidirectional: true,
            depth: 2,
            resolution: 9,
        },
        document: {
            id: "id",
            index: "content",
            store: ["title", "content", "url", "display"],
            tag: "pageId",
        },
        tokenize: "full",
    });

    let pageId = 0;

    Object.entries(searchData).forEach(([route, structurizedData]) => {
        let pageContent = "";

        pageId += 1;

        Object.entries(structurizedData.data).forEach(([key, content]) => {
            const [headingId, headingValue] = key.split("#");
            const url = route + (headingId ? `#${headingId}` : "");
            const title = headingValue ?? structurizedData.title;
            const paragraphs = content.split("\n");

            sectionIndex.add({
                content: title,
                id: url,
                pageId: `page_${pageId}`,
                title,
                url,
                ...(paragraphs[0] && { display: paragraphs[0] }),
            });

            paragraphs.forEach((paragraph, index) => {
                sectionIndex.add({
                    content: paragraph,
                    id: `${url}_${index}`,
                    pageId: `page_${pageId}`,
                    title,
                    url,
                });
            });

            // Add the page itself.
            pageContent += ` ${title} ${content}`;
        });

        pageIndex.add({
            content: pageContent,
            id: pageId,
            title: structurizedData.title,
        });
    });

    // eslint-disable-next-line security/detect-object-injection
    indexes[locale] = [pageIndex, sectionIndex];
};

const loadIndexes = async (basePath: string, locale: string): Promise<void> => {
    const key = `${basePath}@${locale}`;

    if (loadIndexesPromises.has(key)) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await loadIndexesPromises.get(key)!;
        return;
    }

    const promise = loadIndexesImpl(basePath, locale);

    loadIndexesPromises.set(key, promise);

    await promise;
};

const InternalFlexSearch = ({ className = undefined }: { className?: string }): ReactElement => {
    const { basePath, locale = DEFAULT_LOCALE } = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [search, setSearch] = useState("");

    const doSearch = (searchString: string) => {
        if (!searchString) {
            return;
        }

        // eslint-disable-next-line security/detect-object-injection
        const [pageIndex, sectionIndex] = indexes[locale];

        // Show the resultList for the top 5 pages
        const pageResults =
            pageIndex.search<true>(searchString, 5, {
                enrich: true,
                suggest: true,
            })[0]?.result || [];

        const resultList: Result[] = [];
        const pageTitleMatches: Record<number, number> = {};

        pageResults.forEach((result, index) => {
            // eslint-disable-next-line security/detect-object-injection
            pageTitleMatches[index] = 0;

            // Show the top 5 resultList for each page
            const sectionResults =
                sectionIndex.search<true>(searchString, 5, {
                    enrich: true,
                    suggest: true,
                    tag: `page_${result.id}`,
                })[0]?.result || [];

            let isFirstItemOfPage = true;

            const occurred: Record<string, boolean> = {};

            sectionResults.forEach(({ doc }, sectionResultsIndex) => {
                const { content: documentContent, display } = doc;
                const isMatchingTitle = display !== undefined;

                if (isMatchingTitle) {
                    // eslint-disable-next-line security/detect-object-injection
                    pageTitleMatches[index] += 1;
                }

                const { title, url } = doc;
                const content = display || documentContent;

                if (occurred[`${url}@${content}`]) {
                    return;
                }

                occurred[`${url}@${content}`] = true;

                resultList.push({
                    _page_rk: index,
                    _section_rk: sectionResultsIndex,
                    children: (
                        <>
                            <div className="text-base font-semibold leading-5">
                                <HighlightMatches match={searchString} value={title} />
                            </div>
                            {content && (
                                <div className="excerpt mt-1 text-sm leading-[1.35rem] text-gray-600 dark:text-gray-400 contrast-more:dark:text-gray-50">
                                    <HighlightMatches match={searchString} value={content} />
                                </div>
                            )}
                        </>
                    ),
                    prefix: isFirstItemOfPage && (
                        <div
                            className={cn(
                                "mx-2.5 mb-2 mt-6 select-none px-2.5 pb-1.5",
                                "text-xs font-semibold uppercase text-gray-500 first:mt-0 dark:text-gray-300",
                                "border-b border-black/10 dark:border-white/20",
                                "contrast-more:border-gray-600 contrast-more:text-gray-900 contrast-more:dark:border-gray-50 contrast-more:dark:text-gray-50",
                            )}
                        >
                            {result.doc.title}
                        </div>
                    ),
                    route: url,
                });
                isFirstItemOfPage = false;
            });
        });

        setResults(
            resultList
                // eslint-disable-next-line etc/no-assign-mutated-array
                .sort((a, b) => {
                    // Sort by number of matches in the title.
                    if (a._page_rk === b._page_rk) {
                        return a._section_rk - b._section_rk;
                    }

                    if (pageTitleMatches[a._page_rk] !== pageTitleMatches[b._page_rk]) {
                        return pageTitleMatches[b._page_rk] - pageTitleMatches[a._page_rk];
                    }

                    return a._page_rk - b._page_rk;
                })
                .map((result) => {
                    return {
                        children: result.children,
                        id: `${result._page_rk}_${result._section_rk}`,
                        prefix: result.prefix,
                        route: result.route,
                    };
                }),
        );
    };

    const preload = useCallback(
        async (active: boolean) => {
            if (active && !indexes[locale as string]) {
                setLoading(true);

                try {
                    await loadIndexes(basePath as string, locale as string);
                } catch {
                    setError(true);
                }

                setLoading(false);
            }
        },
        [locale, basePath],
    );

    const handleChange = useCallback(
        async (value: string): Promise<void> => {
            setSearch(value);

            if (loading) {
                return;
            }

            if (!indexes[locale as string]) {
                setLoading(true);

                try {
                    await loadIndexes(basePath as string, locale as string);
                } catch {
                    setError(true);
                }

                setLoading(false);
            }

            doSearch(value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [loading, locale, basePath],
    );

    return (
        <Search
            className={className}
            error={error}
            loading={loading}
            onActive={preload}
            onChange={handleChange}
            overlayClassName="w-screen min-h-[100px] max-w-[min(calc(100vw-2rem),calc(100%+20rem))]"
            results={results}
            value={search}
        />
    );
};
/* eslint-enable no-underscore-dangle */

export default InternalFlexSearch;
