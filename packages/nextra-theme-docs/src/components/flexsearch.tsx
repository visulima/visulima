import cn from "clsx";
import BaseFlexSearch from "flexsearch";
import { useRouter } from "next/router";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";

import { DEFAULT_LOCALE } from "../constants";
import type { SearchResult } from "../types";
import HighlightMatches from "./highlight-matches";
import Search from "./search";

type SectionIndex = BaseFlexSearch.Document<
{
    id: string;
    url: string;
    title: string;
    pageId: string;
    content: string;
    display?: string;
},
["title", "content", "url", "display"]
>;

type PageIndex = BaseFlexSearch.Document<
{
    id: number;
    title: string;
    content: string;
},
["title"]
>;

type Result = {
    _page_rk: number;
    _section_rk: number;
    route: string;
    prefix: ReactNode;
    children: ReactNode;
};

type NextraData = {
    [route: string]: {
        title: string;
        data: Record<string, string>;
    };
};

// This can be global for better caching.
const indexes: {
    [locale: string]: [PageIndex, SectionIndex];
} = {};

// Caches promises that load the index
const loadIndexesPromises = new Map<string, Promise<void>>();

/* eslint-disable no-underscore-dangle */
const loadIndexesImpl = async (basePath: string, locale: string): Promise<void> => {
    // eslint-disable-next-line compat/compat
    const response = await fetch(`${basePath}/_next/static/chunks/nextra-data-${locale}.json`);
    const data = (await response.json()) as NextraData;

    const pageIndex: PageIndex = new BaseFlexSearch.Document({
        cache: 100,
        tokenize: "full",
        document: {
            id: "id",
            index: "content",
            store: ["title"],
        },
        context: {
            resolution: 9,
            depth: 2,
            bidirectional: true,
        },
    });

    const sectionIndex: SectionIndex = new BaseFlexSearch.Document({
        cache: 100,
        tokenize: "full",
        document: {
            id: "id",
            index: "content",
            tag: "pageId",
            store: ["title", "content", "url", "display"],
        },
        context: {
            resolution: 9,
            depth: 2,
            bidirectional: true,
        },
    });

    let pageId = 0;

    Object.keys(data).forEach((route) => {
        let pageContent = "";

        pageId += 1;

        Object.keys(data[route].data).forEach((heading) => {
            const [hash, text] = heading.split("#");
            const url = route + (hash ? `#${hash}` : "");
            const title = text || data[route].title;

            const content = data[route].data[heading] || "";
            const paragraphs = content.split("\n").filter(Boolean);

            sectionIndex.add({
                id: url,
                url,
                title,
                pageId: `page_${pageId}`,
                content: title,
                ...(paragraphs[0] && { display: paragraphs[0] }),
            });

            paragraphs.forEach((paragraph, index) => {
                sectionIndex.add({
                    id: `${url}_${index}`,
                    url,
                    title,
                    pageId: `page_${pageId}`,
                    content: paragraph,
                });
            });

            // Add the page itself.
            pageContent += ` ${title} ${content}`;
        });

        pageIndex.add({
            id: pageId,
            title: data[route].title,
            content: pageContent,
        });
    });

    indexes[locale] = [pageIndex, sectionIndex];
};

const loadIndexes = (basePath: string, locale: string): Promise<void> => {
    const key = `${basePath}@${locale}`;

    if (loadIndexesPromises.has(key)) {
        return loadIndexesPromises.get(key)!;
    }

    const promise = loadIndexesImpl(basePath, locale);

    loadIndexesPromises.set(key, promise);

    return promise;
};

const FlexSearch = ({ className }: { className?: string }): ReactElement => {
    const { locale = DEFAULT_LOCALE, basePath } = useRouter();
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [search, setSearch] = useState("");

    // eslint-disable-next-line sonarjs/cognitive-complexity
    const doSearch = (searchString: string) => {
        if (!searchString) {
            return;
        }

        const [pageIndex, sectionIndex] = indexes[locale];

        // Show the resultList for the top 5 pages
        const pageResults = pageIndex.search<true>(searchString, 5, {
            enrich: true,
            suggest: true,
        })[0]?.result || [];

        const resultList: Result[] = [];
        const pageTitleMatches: Record<number, number> = {};

        pageResults.forEach((result, index) => {
            pageTitleMatches[index] = 0;

            // Show the top 5 resultList for each page
            const sectionResults = sectionIndex.search<true>(searchString, 5, {
                enrich: true,
                suggest: true,
                tag: `page_${result.id}`,
            })[0]?.result || [];

            let isFirstItemOfPage = true;

            const occurred: Record<string, boolean> = {};

            sectionResults.forEach(({ doc }, sectionResultsIndex) => {
                const { display, content: documentContent } = doc;
                const isMatchingTitle = display !== undefined;

                if (isMatchingTitle) {
                    pageTitleMatches[index] += 1;
                }

                const { url, title } = doc;
                const content = display || documentContent;

                if (occurred[`${url}@${content}`]) {
                    return;
                }

                occurred[`${url}@${content}`] = true;

                resultList.push({
                    _page_rk: index,
                    _section_rk: sectionResultsIndex,
                    route: url,
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
                });
                isFirstItemOfPage = false;
            });
        });

        setResults(
            resultList
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
                        id: `${result._page_rk}_${result._section_rk}`,
                        route: result.route,
                        prefix: result.prefix,
                        children: result.children,
                    };
                }),
        );
    };

    const preload = useCallback(
        async (active: boolean) => {
            if (active && !indexes[locale]) {
                setLoading(true);

                await loadIndexes(basePath, locale);

                setLoading(false);
            }
        },
        [locale, basePath],
    );

    const handleChange = async (value: string) => {
        setSearch(value);

        if (loading) {
            return;
        }

        if (!indexes[locale]) {
            setLoading(true);

            await loadIndexes(basePath, locale);

            setLoading(false);
        }
        doSearch(value);
    };

    return (
        <Search
            loading={loading}
            value={search}
            onChange={handleChange}
            onActive={preload}
            className={className}
            overlayClassName="w-screen min-h-[100px] max-w-[min(calc(100vw-2rem),calc(100%+20rem))]"
            results={results}
        />
    );
};
/* eslint-enable no-underscore-dangle */

export default FlexSearch;
