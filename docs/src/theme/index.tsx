import "focus-visible";
import "./polyfill";

import { MDXProvider } from "@mdx-js/react";
import { SkipNavContent } from "@reach/skip-nav";
import cn from "clsx";
import { useRouter } from "next/router";
import type { PageMapItem, PageOpts } from "nextra";
import type { FC, PropsWithChildren, ReactNode } from "react";
import React, { useMemo, useRef } from "react";
import { Toaster } from "react-hot-toast";

import Banner from "../components/banner";
import Breadcrumb from "../components/breadcrumb";
import Comments from "../components/comments";
import Footer from "../components/footer";
import Head from "../components/head";
import NavLinks from "../components/nav-links";
import Sidebar from "../components/sidebar";
import { DEFAULT_LOCALE } from "../constants";
import { ActiveAnchorProvider, ConfigProvider, useConfig } from "../contexts";
import getComponents from "../mdx-components";
import type { PageTheme } from "../types";
import { getFSRoute, normalizePages, renderComponent } from "../utils";
import useOnScreen from "../utils/use-on-screen";

const useDirectoryInfo = (pageMap: PageMapItem[]) => {
    const { locale = DEFAULT_LOCALE, defaultLocale, route } = useRouter();

    return useMemo(() => {
        // asPath can return redirected url
        const fsPath = getFSRoute(route, locale);

        return normalizePages({
            list: pageMap,
            locale,
            defaultLocale,
            route: fsPath,
        });
    }, [pageMap, locale, defaultLocale, route]);
};

const Body: FC<{
    themeContext: PageTheme;
    breadcrumb: ReactNode;
    timestamp?: number;
    navigation: ReactNode;
    children: ReactNode;
    activeType: string;
}> = ({
    themeContext, breadcrumb, timestamp, navigation, children, activeType,
}) => {
    const config = useConfig();

    if (themeContext.layout === "raw") {
        return <div className="w-full overflow-x-hidden">{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement = date ? (
        <div className="mt-12 mb-8 block text-xs text-gray-500 px-8 ltr:text-right rtl:text-left dark:text-gray-400">
            {renderComponent(config.gitTimestamp, { timestamp: date })}
        </div>
    ) : (
        <div className="mt-16" />
    );

    const content = (
        <>
            {children}
            {activeType === "docs" && <Comments />}
            {gitTimestampElement}
            {navigation}
        </>
    );

    const body = config.main?.({ children: content }) || content;

    if (themeContext.layout === "full") {
        return (
            // eslint-disable-next-line max-len
            <article className="min-h-[calc(100vh-4rem)] w-full overflow-x-hidden pl-[max(env(safe-area-inset-left),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)]">
                {body}
            </article>
        );
    }

    return (
        <article
            className={cn(
                // eslint-disable-next-line max-len
                "flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full justify-center pr-[calc(env(safe-area-inset-right)-1.5rem)] bg-white dark:bg-darker-800",
                themeContext.typesetting === "article" && "nextra-body-typesetting-article",
            )}
        >
            <main className={cn("w-full min-w-0 pt-4", activeType === "doc" ? "max-w-4xl px-6 md:px-8" : "")}>
                {breadcrumb}
                {body}
            </main>
        </article>
    );
};

const InnerLayout: FC<PropsWithChildren<PageOpts>> = ({
    filePath,
    pageMap,
    frontMatter,
    headings,
    timestamp,
    children,
    // eslint-disable-next-line radar/cognitive-complexity
}) => {
    const config = useConfig();
    const {
        activeType, activeIndex, activeThemeContext, activePath, topLevelNavbarItems, docsDirectories, flatDirectories, flatDocsDirectories, directories,
    } = useDirectoryInfo(pageMap);
    const reference: any = useRef<HTMLDivElement>();
    const isOnScreen = useOnScreen(reference, `-${(reference?.current?.clientHeight || 0) + 50}px`);

    const themeContext = { ...activeThemeContext, ...frontMatter };
    const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || activeType === "page";
    const tocClassName = "nextra-tocSidebar order-last hidden w-64 shrink-0 xl:block";
    const isDocumentPage = activeType === "doc" || themeContext.toc;

    const tocSidebarElement = isDocumentPage && (
        <div className={cn(tocClassName, "px-4")}>
            {renderComponent(config.tocSidebar.component, {
                headings: config.tocSidebar.float ? headings : [],
                filePath,
                isOnScreen: !isOnScreen,
            })}
        </div>
    );
    const tocPageContentElement = isDocumentPage
        && renderComponent(config.tocContent.component, {
            headings: config.tocContent.float ? headings : [],
            wrapperRef: reference,
        });

    const { locale = DEFAULT_LOCALE, route } = useRouter();
    const localeConfig = config.i18n.find((l) => l.locale === locale);
    const isRTL = localeConfig ? localeConfig.direction === "rtl" : config.direction === "rtl";
    const direction = isRTL ? "rtl" : "ltr";

    const ArticleOrSection = activeType === "doc" ? "article" : "section";

    return (
        <>
            <Toaster />
            {/* This makes sure that selectors like `[dir=ltr] .nextra-container` */}
            {/* work // before hydration as Tailwind expects the `dir` attribute to exist on the `html` element. */}
            <div
                dir={direction}
                className={activeType === "page" ? "" : "md:bg-x-gradient-gray-200-gray-200-50-white-50 md:dark:bg-x-gradient-dark-700-dark-700-50-dark-800"}
            >
                <script
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                        __html: `document.documentElement.setAttribute('dir','${direction}')`,
                    }}
                />
                <Head />
                <Banner />
                {themeContext.navbar
                    && renderComponent(config.navbar.component, {
                        flatDirectories,
                        items: topLevelNavbarItems,
                        activeType,
                    })}
                <div className={cn("mx-auto flex", themeContext.layout !== "raw" && "max-w-[90rem]")}>
                    <ActiveAnchorProvider>
                        {activeType === "doc" && (
                            <Sidebar
                                docsDirectories={docsDirectories}
                                flatDirectories={flatDirectories}
                                fullDirectories={directories}
                                headings={headings}
                                asPopover={hideSidebar}
                                includePlaceholder={themeContext.layout === "default"}
                            />
                        )}
                        <div className="relative w-full">
                            {activeType === "doc" && config.hero?.component && (
                                <div
                                    className={`absolute w-full ${
                                        config.hero?.height
                                            ? (typeof config.hero.height === "string"
                                                ? `h-[${config.hero.height}]`
                                                : `h-[${config.hero.height}px]`)
                                            : ""
                                    }`}
                                >
                                    {renderComponent(config.hero.component, { route })}
                                </div>
                            )}
                            <div
                                className={`flex w-full${
                                    config.hero?.height
                                        ? (typeof config.hero.height === "string"
                                            ? ` mt-[${config.hero.height}]`
                                            : ` mt-[${config.hero.height}px]`)
                                        : ""
                                }`}
                            >
                                {tocSidebarElement}
                                <SkipNavContent />
                                <Body
                                    themeContext={themeContext}
                                    breadcrumb={activeType !== "page" && themeContext.breadcrumb ? <Breadcrumb activePath={activePath} /> : null}
                                    timestamp={timestamp}
                                    navigation={
                                        activeType !== "page" && themeContext.pagination ? (
                                            <NavLinks flatDirectories={flatDocsDirectories} currentIndex={activeIndex} />
                                        ) : null
                                    }
                                    activeType={activeType}
                                >
                                    {activeType === "doc" && (
                                        <h1 className="md:text-4xl lg:text-5xl text-3xl leading-tall tracking-tight font-bold hyphenated mt-4">
                                            {activePath[Object.keys(activePath).length - 1].title}
                                        </h1>
                                    )}
                                    {tocPageContentElement}
                                    <ArticleOrSection
                                        className={cn(
                                            activeType === "doc"
                                                ? [
                                                    "prose prose-slate max-w-none dark:prose-invert dark:text-slate-400",
                                                    // headings
                                                    // eslint-disable-next-line max-len
                                                    "prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]",
                                                    // lead
                                                    "prose-lead:text-slate-500 dark:prose-lead:text-slate-400",
                                                    // links
                                                    // eslint-disable-next-line max-len
                                                    "prose-a:font-medium dark:prose-a:text-primary-400 hover:prose-a:text-gray-900 dark:hover:prose-a:text-gray-500",
                                                    // link underline
                                                    "prose-a:no-underline dark:hover:prose-a:[--tw-prose-underline-size:6px]",
                                                    // pre
                                                    // eslint-disable-next-line max-len
                                                    "prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10",
                                                    // hr
                                                    "dark:prose-hr:border-slate-800",
                                                ]
                                                : "",
                                        )}
                                    >
                                        <MDXProvider
                                            components={getComponents({
                                                isRawLayout: themeContext.layout === "raw",
                                                components: config.components,
                                            })}
                                        >
                                            {children}
                                        </MDXProvider>
                                    </ArticleOrSection>
                                </Body>
                            </div>
                        </div>
                    </ActiveAnchorProvider>
                </div>
                {themeContext.footer && <Footer activeType={activeType} />}
            </div>
        </>
    );
};

const Theme: FC = (properties) => {
    const { route } = useRouter();
    // eslint-disable-next-line no-underscore-dangle
    const context = globalThis.__nextra_pageContext__[route];

    if (!context) {
        throw new Error(`No content found for ${route}.`);
    }

    const { pageOpts, Content } = context;

    return (
        <ConfigProvider value={context}>
            <InnerLayout {...pageOpts}>
                <Content {...properties} />
            </InnerLayout>
        </ConfigProvider>
    );
};

export default Theme;
