import "focus-visible";
import "./polyfill";

import { MDXProvider } from "@mdx-js/react";
import { SkipNavContent } from "@reach/skip-nav";
import cn from "clsx";
import { useRouter } from "next/router";
import type { PageMapItem, PageOpts } from "nextra";
import type { ReactElement, ReactNode } from "react";
import React, { useMemo, useRef, Fragment } from "react";

import Banner from "../components/banner";
import Breadcrumb from "../components/breadcrumb";
import Head from "../components/head";
import NavLinks from "../components/nav-links";
import Sidebar from "../components/sidebar";
import { DEFAULT_LOCALE } from "../constants";
import { ActiveAnchorProvider, ConfigProvider, useConfig } from "../contexts";
import { getComponents } from "../mdx-components";
import type { DocsThemeConfig, PageTheme, RecursivePartial } from "../types";
import { getFSRoute, normalizePages, renderComponent } from "../utils";
import useOnScreen from "../utils/use-on-screen";
import Comments from "../components/comments";

function useDirectoryInfo(pageMap: PageMapItem[]) {
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
}

interface BodyProperties {
    themeContext: PageTheme;
    breadcrumb: ReactNode;
    timestamp?: number;
    navigation: ReactNode;
    children: ReactNode;
}

const Body = ({ themeContext, breadcrumb, timestamp, navigation, children }: BodyProperties): ReactElement => {
    const config = useConfig();

    if (themeContext.layout === "raw") {
        return <div className="w-full overflow-x-hidden">{children}</div>;
    }

    const date = themeContext.timestamp && config.gitTimestamp && timestamp ? new Date(timestamp) : null;

    const gitTimestampElement = date ? (
        <div className="mt-12 mb-8 block text-xs text-gray-500 ltr:text-right rtl:text-left dark:text-gray-400">
            {renderComponent(config.gitTimestamp, { timestamp: date })}
        </div>
    ) : (
        <div className="mt-16" />
    );

    const content = (
        <>
            {children}
            <Comments />
            {gitTimestampElement}
            {navigation}
        </>
    );

    const body = config.main?.({ children: content }) || content;

    if (themeContext.layout === "full") {
        return (
            <article className="min-h-[calc(100vh-4rem)] w-full overflow-x-hidden pl-[max(env(safe-area-inset-left),1.5rem)] pr-[max(env(safe-area-inset-right),1.5rem)]">
                {body}
            </article>
        );
    }

    return (
        <article
            className={cn(
                "flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)] bg-white",
                themeContext.typesetting === "article" && "nextra-body-typesetting-article",
            )}
        >
            <main className="w-full min-w-0 max-w-4xl px-6 pt-4 md:px-8">
                {breadcrumb}
                {body}
            </main>
        </article>
    );
};

const InnerLayout = ({ filePath, pageMap, frontMatter, headings, timestamp, children }: PageOpts & { children: ReactNode }): ReactElement => {
    const config = useConfig();
    const { activeType, activeIndex, activeThemeContext, activePath, topLevelNavbarItems, docsDirectories, flatDirectories, flatDocsDirectories, directories } =
        useDirectoryInfo(pageMap);
    const ref: any = useRef<HTMLDivElement>();
    const isOnScreen = useOnScreen(ref, `-${(ref?.current?.clientHeight || 0) + 50}px`);

    const themeContext = { ...activeThemeContext, ...frontMatter };
    const hideSidebar = !themeContext.sidebar || themeContext.layout === "raw" || activeType === "page";
    const tocClassName = "nextra-tocSidebar order-last hidden w-64 shrink-0 xl:block";
    const isNotDocPage = activeType === "page" || !themeContext.toc || themeContext.layout !== "default";

    const tocSidebarElement = isNotDocPage ? (
        themeContext.layout !== "full" && themeContext.layout !== "raw" && <div className={tocClassName} />
    ) : (
        <div className={cn(tocClassName, "px-4")}>
            {renderComponent(config.tocSidebar.component, {
                headings: config.tocSidebar.float ? headings : [],
                filePath,
                isOnScreen: !isOnScreen,
            })}
        </div>
    );
    const tocPageContentElement =
        !isNotDocPage &&
        renderComponent(config.tocContent.component, {
            headings: config.tocContent.float ? headings : [],
            wrapperRef: ref
        });

    const { locale = DEFAULT_LOCALE, route } = useRouter();
    const localeConfig = config.i18n.find((l) => l.locale === locale);
    const isRTL = localeConfig ? localeConfig.direction === "rtl" : config.direction === "rtl";
    const direction = isRTL ? "rtl" : "ltr";

    return (
        // This makes sure that selectors like `[dir=ltr] .nextra-container` work
        // before hydration as Tailwind expects the `dir` attribute to exist on the
        // `html` element.
        <div dir={direction}>
            <script
                dangerouslySetInnerHTML={{
                    __html: `document.documentElement.setAttribute('dir','${direction}')`,
                }}
            />
            <Head />
            <Banner />
            {themeContext.navbar &&
                renderComponent(config.navbar, {
                    flatDirectories,
                    items: topLevelNavbarItems,
                })}
            <div className={cn("mx-auto flex", themeContext.layout !== "raw" && "max-w-[90rem]")}>
                <ActiveAnchorProvider>
                    <Sidebar
                        docsDirectories={docsDirectories}
                        flatDirectories={flatDirectories}
                        fullDirectories={directories}
                        headings={headings}
                        asPopover={hideSidebar}
                        includePlaceholder={themeContext.layout === "default"}
                    />
                    <div className="w-full relative">
                        {config.hero?.component && (<div className={`absolute w-full ${config.hero?.height ? typeof config.hero.height === "string" ? `h-[${config.hero.height}]` : `h-[${config.hero.height}px]` : ""}`}>{renderComponent(config.hero.component, { route })}</div>)}
                        <div className={`flex w-full${config.hero?.height ? typeof config.hero.height === "string" ? ` mt-[${config.hero.height}]` : ` mt-[${config.hero.height}px]` : ""}`}>
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
                            >
                                <h1 className="md:text-4xl lg:text-5xl text-3xl leading-tall tracking-tight font-bold hyphenated mt-4">
                                    {activePath[Object.keys(activePath).length - 1].title}
                                </h1>
                                {tocPageContentElement}
                                <article className="prose prose-slate max-w-none dark:prose-invert dark:text-slate-400 prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem] prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,theme(colors.sky.300))] hover:prose-a:[--tw-prose-underline-size:6px] dark:[--tw-prose-background:theme(colors.slate.900)] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,theme(colors.sky.800))] dark:hover:prose-a:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800">
                                    <MDXProvider
                                        components={getComponents({
                                            isRawLayout: themeContext.layout === "raw",
                                            components: config.components,
                                        })}
                                    >
                                        {children}
                                    </MDXProvider>
                                </article>
                            </Body>
                        </div>
                    </div>
                </ActiveAnchorProvider>
            </div>
            {themeContext.footer && renderComponent(config.footer.component, { menu: hideSidebar })}
        </div>
    );
};

export default function Index(properties: any): ReactElement {
    const { route } = useRouter();
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
}

type PartialDocsThemeConfig = RecursivePartial<DocsThemeConfig>;

export type { PartialDocsThemeConfig as DocsThemeConfig };
